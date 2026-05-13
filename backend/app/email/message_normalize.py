"""Normaliza payloads de ingestión (JSON genérico) y mensajes MIME (IMAP / raw)."""

from __future__ import annotations

import base64
import binascii
import email.policy
import re
from dataclasses import dataclass, field
from email import message_from_bytes
from typing import Any


def message_id_from_raw_mime(blob: bytes) -> str | None:
    """Message-ID extraído de RFC822 (p. ej. antes de insertar en staging)."""
    try:
        msg = message_from_bytes(blob, policy=email.policy.default)
    except Exception:
        return None
    return normalize_message_id(msg.get("Message-ID") or msg.get("Message-Id"))


def reference_message_ids_from_header(raw: str | None) -> list[str]:
    """Cabecera References: lista de Message-IDs normalizados en orden."""
    if raw is None or not str(raw).strip():
        return []
    out: list[str] = []
    for m in re.finditer(r"<[^>]+>", str(raw)):
        n = normalize_message_id(m.group(0))
        if n:
            out.append(n)
    return out


def normalize_message_id(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if s.startswith("<") and s.endswith(">"):
        s = s[1:-1].strip()
    return s or None


@dataclass
class AttachmentPart:
    filename: str
    content: bytes
    mime_type: str


@dataclass
class ParsedInbound:
    subject: str
    from_email: str
    message_id: str | None
    in_reply_to: str | None
    body_text: str
    references: str | None = None
    attachments: list[AttachmentPart] = field(default_factory=list)


def _first_email_from_sender(sender: str) -> str:
    """Extrae dirección de 'Nombre <a@b.com>' o 'a@b.com'."""
    s = (sender or "").strip()
    if "<" in s and ">" in s:
        inner = s[s.find("<") + 1 : s.find(">")]
        return inner.strip().lower()
    return s.lower()


def _pick_plain_html(payload: dict[str, Any]) -> tuple[str, str]:
    plain = (
        payload.get("body-plain")
        or payload.get("body_plain")
        or payload.get("text")
        or payload.get("stripped-text")
        or payload.get("stripped_text")
        or ""
    )
    html = (
        payload.get("body-html")
        or payload.get("body_html")
        or payload.get("html")
        or payload.get("stripped-html")
        or payload.get("stripped_html")
        or ""
    )
    if isinstance(plain, str) and plain.strip():
        return plain.strip(), html.strip() if isinstance(html, str) else ""
    return "", html.strip() if isinstance(html, str) else ""


def parse_custom_attachments(payload: dict[str, Any]) -> list[AttachmentPart]:
    out: list[AttachmentPart] = []
    raw_list = payload.get("attachments")
    if not isinstance(raw_list, list):
        return out
    for item in raw_list:
        if not isinstance(item, dict):
            continue
        fn = item.get("filename") or item.get("name") or "file.bin"
        b64 = item.get("content_base64") or item.get("base64")
        mime = str(item.get("content_type") or item.get("mime_type") or "application/octet-stream")
        if not isinstance(fn, str):
            fn = "file.bin"
        if not isinstance(b64, str):
            continue
        try:
            data = base64.b64decode(b64, validate=False)
        except (binascii.Error, ValueError):
            continue
        out.append(AttachmentPart(filename=fn[:255], content=data, mime_type=mime[:128]))
    return out


def parse_from_payload(payload: dict[str, Any]) -> ParsedInbound:
    """JSON genérico (campos planos tipo webhook) o payload mínimo antes de enriquecer con MIME."""
    subject = str(payload.get("subject") or "(sin asunto)")[:500]
    sender = payload.get("sender") or payload.get("from") or ""
    from_email = _first_email_from_sender(str(sender))

    mid = normalize_message_id(
        payload.get("Message-Id")
        or payload.get("Message-ID")
        or payload.get("message-id")
        or payload.get("message_id")
    )
    irt = normalize_message_id(
        payload.get("In-Reply-To")
        or payload.get("in-reply-to")
        or payload.get("in_reply_to")
    )
    refs_raw = payload.get("References") or payload.get("references")
    references = str(refs_raw).strip() if isinstance(refs_raw, str) and refs_raw.strip() else None

    plain, html = _pick_plain_html(payload)
    body_text = plain
    if not body_text and html:
        from app.email.html_sanitize import sanitize_body_html

        body_text = sanitize_body_html(html)

    att = parse_custom_attachments(payload)

    return ParsedInbound(
        subject=subject,
        from_email=from_email,
        message_id=mid,
        in_reply_to=irt,
        body_text=body_text[:100_000],
        references=references,
        attachments=att,
    )


def _attachments_from_mime_bytes(blob: bytes) -> list[AttachmentPart]:
    out: list[AttachmentPart] = []
    try:
        msg = message_from_bytes(blob, policy=email.policy.default)
    except Exception:
        return out
    if msg.is_multipart():
        for part in msg.walk():
            disp = str(part.get_content_disposition() or "")
            if disp != "attachment" and part.get_filename() is None:
                continue
            fn = part.get_filename() or "attachment.bin"
            try:
                payload = part.get_payload(decode=True)
            except Exception:
                payload = None
            if payload is None:
                continue
            ctype = part.get_content_type() or "application/octet-stream"
            out.append(AttachmentPart(filename=fn[:255], content=payload, mime_type=ctype[:128]))
    return out


def enrich_from_raw_mime(parsed: ParsedInbound, raw_bytes: bytes) -> ParsedInbound:
    """Si hay MIME completo, sobreescribe cabeceras con las del mensaje parseado."""
    try:
        msg = message_from_bytes(raw_bytes, policy=email.policy.default)
    except Exception:
        return parsed

    subj = msg.get("Subject")
    if subj:
        parsed.subject = str(subj)[:500]

    frm = msg.get("From")
    if frm:
        parsed.from_email = _first_email_from_sender(str(frm))

    mid = normalize_message_id(msg.get("Message-ID") or msg.get("Message-Id"))
    if mid:
        parsed.message_id = mid

    irt = normalize_message_id(msg.get("In-Reply-To"))
    if irt:
        parsed.in_reply_to = irt

    refs = msg.get("References")
    if refs:
        parsed.references = str(refs).strip()[:16_384] or None

    body_plain = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == "text/plain":
                try:
                    body_plain = part.get_content().strip()
                except Exception:
                    body_plain = ""
                if body_plain:
                    break
    else:
        if msg.get_content_type() == "text/plain":
            try:
                body_plain = msg.get_content().strip()
            except Exception:
                body_plain = ""

    if body_plain:
        parsed.body_text = body_plain[:100_000]
    elif msg.get_content_type() == "text/html":
        from app.email.html_sanitize import sanitize_body_html

        try:
            html = msg.get_content()
            parsed.body_text = sanitize_body_html(str(html))[:100_000]
        except Exception:
            pass

    parsed.attachments.extend(_attachments_from_mime_bytes(raw_bytes))
    return parsed
