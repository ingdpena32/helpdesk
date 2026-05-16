"""
Worker: ingestion_events → tickets / comentarios / adjuntos.

Ejecutar desde la carpeta backend:

    python -m app.email.worker
"""

from __future__ import annotations

import base64
import binascii
import logging
import re
import secrets
import time
import traceback
from pathlib import Path
from typing import Any

import psycopg2.errors

from app.database.db import get_connection
from app.email import config as email_config
from app.email.message_normalize import (
    ParsedInbound,
    enrich_from_raw_mime,
    parse_from_payload,
    reference_message_ids_from_header,
)
from app.repositories import (
    ingestion_repository,
    ticket_attachment_repository,
    ticket_comment_repository,
    ticket_repository,
    user_repository,
)
from app.services import notification_service, ticket_ai_classification

logger = logging.getLogger(__name__)


def _mime_allowed(mime: str) -> bool:
    ml = (mime or "").lower().strip()
    if not ml:
        return False
    allowed = email_config.allowed_mime_prefixes()
    for p in allowed:
        if p.endswith("/") and ml.startswith(p):
            return True
        if ml == p:
            return True
    return False


def _domain_allowed(email: str) -> bool:
    allowed = email_config.allowed_email_domains()
    if not allowed:
        return True
    if "@" not in email:
        return False
    dom = email.rsplit("@", 1)[-1].lower().strip()
    return dom in allowed


def _safe_filename(name: str) -> str:
    base = Path(name).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)[:120] or "file.bin"


def _store_attachment(root: Path, part_filename: str, data: bytes) -> str:
    """Devuelve ruta relativa al directorio backend."""
    safe = _safe_filename(part_filename)
    stored = f"{secrets.token_hex(16)}_{safe}"
    path = root / stored
    path.write_bytes(data)
    backend_root = Path(__file__).resolve().parent.parent.parent
    try:
        return str(path.relative_to(backend_root))
    except ValueError:
        return str(path)


def _raw_bytes_from_payload(payload: dict) -> bytes:
    b64 = payload.get("raw_mime_b64")
    if isinstance(b64, str) and b64.strip():
        try:
            return base64.standard_b64decode(b64)
        except (binascii.Error, ValueError):
            return b""
    raw = payload.get("raw_mime")
    if isinstance(raw, str) and raw.strip():
        return raw.encode("utf-8", errors="replace")
    return b""


def _find_parent_ticket_id(conn, parsed: ParsedInbound) -> int | None:
    if parsed.in_reply_to:
        tid = ticket_repository.find_ticket_id_by_message_reference(conn, parsed.in_reply_to)
        if tid is not None:
            return tid
    for mid in reversed(reference_message_ids_from_header(parsed.references)):
        if not mid or (parsed.message_id and mid == parsed.message_id):
            continue
        tid = ticket_repository.find_ticket_id_by_message_reference(conn, mid)
        if tid is not None:
            return tid
    return None


def _message_exists(conn, message_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM tickets WHERE email_message_id = %s AND deleted_at IS NULL LIMIT 1",
            (message_id,),
        )
        if cur.fetchone():
            return True
        cur.execute("SELECT 1 FROM ticket_comments WHERE message_id = %s LIMIT 1", (message_id,))
        if cur.fetchone():
            return True
    return False


def _process_parsed(
    conn,
    *,
    parsed: ParsedInbound,
    system_user_id: int,
    attachments_root: Path,
) -> tuple[str, int | None, dict[str, Any] | None]:
    """
    Crea ticket o comentario. Devuelve (modo, ticket_id_del_hilo, payload_clasificación_ia_o_None).
    El tercer valor solo aplica a tickets nuevos (no comentarios en hilo).
    """
    mid = parsed.message_id
    if not mid:
        raise ValueError("Falta Message-ID; no se puede garantizar idempotencia")

    if _message_exists(conn, mid):
        raise LookupError("duplicate_message_id")

    body = parsed.body_text.strip() or "(sin cuerpo)"
    title = (parsed.subject or "(sin asunto)")[:500]

    if not _domain_allowed(parsed.sender_email or parsed.from_email):
        raise PermissionError(f"Dominio no permitido: {parsed.sender_email or parsed.from_email}")

    parent_tid = _find_parent_ticket_id(conn, parsed)
    if parsed.in_reply_to and parent_tid is None:
        raise ValueError(f"No se encontró ticket para In-Reply-To: {parsed.in_reply_to}")

    if parent_tid is not None:
        if ticket_repository.find_by_id(conn, parent_tid) is None:
            raise ValueError("Ticket padre no existe")

        comment = ticket_comment_repository.insert_from_email(
            conn,
            ticket_id=parent_tid,
            body=body,
            message_id=mid,
            author_email=parsed.sender_email or parsed.from_email,
        )
        tid = parent_tid
        last_comment_id = comment.id
        mode = "comment"
        ai_schedule: dict[str, Any] | None = None
    else:
        sender_user_id: int | None = None
        se = (parsed.sender_email or parsed.from_email or "").strip().lower()
        if se:
            u_match = user_repository.find_by_email(conn, se)
            if u_match is not None:
                sender_user_id = u_match.id
                logger.info(
                    "Ticket por correo: remitente coincide con usuario id=%s email=%s",
                    sender_user_id,
                    se,
                )
            else:
                logger.info("Ticket por correo: remitente externo email=%s", se)

        t = ticket_repository.insert_from_inbound(
            conn,
            title=title,
            description=body,
            created_by=system_user_id,
            priority="medium",
            category="Soporte técnico",
            email_message_id=mid,
            sender_name=(parsed.sender_name or "").strip() or None,
            sender_email=se or None,
            raw_from=parsed.raw_from,
            sender_user_id=sender_user_id,
        )
        logger.info(
            "Ticket #%s creado desde correo message_id=%s raw_from_len=%s",
            t.id,
            mid,
            len(parsed.raw_from or ""),
        )
        tid = t.id
        last_comment_id = None
        mode = "ticket"
        ai_schedule = {"ticket_id": tid, "subject": title, "body": body}

    max_bytes = email_config.max_attachment_bytes()
    for part in parsed.attachments:
        if len(part.content) > max_bytes:
            continue
        if not _mime_allowed(part.mime_type):
            continue
        rel = _store_attachment(attachments_root, part.filename, part.content)
        ticket_attachment_repository.insert(
            conn,
            ticket_id=tid,
            comment_id=last_comment_id,
            original_filename=part.filename[:255],
            mime_type=part.mime_type[:128],
            size_bytes=len(part.content),
            storage_path=rel,
        )

    return mode, tid, ai_schedule


def process_one_event(conn, event: dict, *, system_user_id: int, attachments_root: Path) -> dict[str, Any] | None:
    eid = int(event["id"])
    payload = event["payload"]
    if not isinstance(payload, dict):
        raise ValueError("payload_json inválido")

    ingestion_repository.mark_processing(conn, eid)

    raw_bytes = _raw_bytes_from_payload(payload)
    if raw_bytes:
        parsed = parse_from_payload({})
        parsed = enrich_from_raw_mime(parsed, raw_bytes)
        logger.info(
            "Evento %s: MIME parseado subject=%r sender_email=%r message_id=%s",
            eid,
            (parsed.subject or "")[:80],
            parsed.sender_email or parsed.from_email,
            parsed.message_id,
        )
    else:
        parsed = parse_from_payload(payload)
        logger.info(
            "Evento %s: payload parseado sender_email=%r message_id=%s",
            eid,
            parsed.sender_email or parsed.from_email,
            parsed.message_id,
        )

    if not parsed.message_id:
        raise ValueError("No se pudo determinar Message-ID")

    schedule_out: dict[str, Any] | None = None
    try:
        mode, tid, schedule_out = _process_parsed(
            conn, parsed=parsed, system_user_id=system_user_id, attachments_root=attachments_root
        )
        t = ticket_repository.find_by_id(conn, tid)
        if t is not None:
            if mode == "ticket":
                notification_service.notify_ticket_created_email(conn, t)
            elif mode == "comment":
                preview = (parsed.body_text or "").strip() or "(sin cuerpo)"
                notification_service.notify_ticket_comment_for_assignee(
                    conn, ticket=t, author_user_id=None, preview=preview
                )
    except LookupError as e:
        if str(e) == "duplicate_message_id":
            ingestion_repository.mark_duplicate(conn, eid)
            logger.info(
                "Evento %s ignorado: Message-ID ya procesado (%s)",
                eid,
                parsed.message_id,
            )
            return None
        raise

    ingestion_repository.mark_completed(conn, eid, message_id=parsed.message_id)
    return schedule_out


def run_loop() -> None:
    email = email_config.system_inbound_user_email()
    poll = email_config.worker_poll_seconds()
    batch = email_config.worker_batch_size()
    max_retries = email_config.worker_max_retries()
    root = email_config.attachments_dir()

    print(f"Worker correo: usuario sistema '{email}', adjuntos en {root}")
    while True:
        try:
            with get_connection() as conn:
                conn.autocommit = False
                u = user_repository.find_by_email(conn, email)
                if u is None:
                    conn.rollback()
                    print(f"ERROR: no existe usuario sistema {email}. Ejecute la migración SQL 7.")
                    time.sleep(30)
                    continue
                system_uid = u.id

                events = ingestion_repository.fetch_pending_batch(conn, limit=batch, max_retries=max_retries)
                if not events:
                    conn.rollback()
                    time.sleep(poll)
                    continue

                for ev in events:
                    try:
                        schedule_ai = process_one_event(conn, ev, system_user_id=system_uid, attachments_root=root)
                        conn.commit()
                        if schedule_ai:
                            ticket_ai_classification.schedule_ai_classification_after_commit(
                                ticket_id=int(schedule_ai["ticket_id"]),
                                subject=str(schedule_ai["subject"]),
                                body=str(schedule_ai["body"]),
                            )
                    except psycopg2.errors.UniqueViolation:
                        conn.rollback()
                        ingestion_repository.mark_duplicate(conn, int(ev["id"]))
                        conn.commit()
                    except Exception as ex:
                        conn.rollback()
                        err = f"{ex.__class__.__name__}: {ex}"
                        tb = traceback.format_exc()
                        print(tb)
                        if int(ev.get("retry_count") or 0) >= max_retries - 1:
                            ingestion_repository.mark_failed(conn, int(ev["id"]), err, increment_retry=True)
                        else:
                            ingestion_repository.reset_to_pending_after_failure(conn, int(ev["id"]), err)
                        conn.commit()

        except Exception:
            traceback.print_exc()
            time.sleep(min(poll * 2, 60))


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    run_loop()
