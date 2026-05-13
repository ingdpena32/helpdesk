"""Variables de entorno para correo entrante (IMAP → staging → worker)."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_BACKEND_ROOT / ".env")


def max_payload_bytes() -> int:
    """Tamaño máximo del cuerpo HTTP (Flask) y tope del JSON guardado en ingestion_events (IMAP base64)."""
    return int(os.getenv("INBOUND_MAX_PAYLOAD_BYTES", str(12 * 1024 * 1024)))


def max_attachment_bytes() -> int:
    return int(os.getenv("INBOUND_MAX_ATTACHMENT_BYTES", str(10 * 1024 * 1024)))


def allowed_email_domains() -> frozenset[str]:
    raw = os.getenv("INBOUND_ALLOWED_DOMAINS", "")
    parts = [p.strip().lower().lstrip("@") for p in raw.split(",") if p.strip()]
    return frozenset(parts)


def attachments_dir() -> Path:
    p = Path(os.getenv("ATTACHMENTS_STORAGE_DIR", str(_BACKEND_ROOT / "data" / "attachments")))
    p.mkdir(parents=True, exist_ok=True)
    return p


def allowed_mime_prefixes() -> frozenset[str]:
    raw = os.getenv(
        "INBOUND_ALLOWED_MIME_PREFIXES",
        "image/,text/plain,application/pdf,application/json,text/csv",
    )
    return frozenset(x.strip().lower() for x in raw.split(",") if x.strip())


def system_inbound_user_email() -> str:
    return os.getenv("INBOUND_SYSTEM_USER_EMAIL", "inbound@system.local").strip().lower()


def worker_poll_seconds() -> float:
    return float(os.getenv("EMAIL_WORKER_POLL_SECONDS", "4"))


def worker_batch_size() -> int:
    return int(os.getenv("EMAIL_WORKER_BATCH_SIZE", "8"))


def worker_max_retries() -> int:
    return int(os.getenv("EMAIL_WORKER_MAX_RETRIES", "8"))


def email_user() -> str:
    return os.getenv("EMAIL_USER", "").strip()


def email_password() -> str:
    return os.getenv("EMAIL_PASSWORD", "").strip()


def imap_server() -> str:
    return os.getenv("IMAP_SERVER", "imap.gmail.com").strip()


def imap_port() -> int:
    return int(os.getenv("IMAP_PORT", "993"))


def imap_mailbox() -> str:
    return os.getenv("IMAP_MAILBOX", "INBOX").strip() or "INBOX"


def imap_poll_seconds() -> float:
    return float(os.getenv("EMAIL_IMAP_POLL_SECONDS", "60"))


def imap_socket_timeout_seconds() -> float:
    """Timeout de lectura/escritura del socket IMAP (evita colgar indefinidamente)."""
    return float(os.getenv("EMAIL_IMAP_SOCKET_TIMEOUT_SECONDS", "120"))


def imap_max_retries_per_cycle() -> int:
    return int(os.getenv("EMAIL_IMAP_MAX_RETRIES_PER_CYCLE", "5"))


def imap_retry_backoff_base_seconds() -> float:
    return float(os.getenv("EMAIL_IMAP_RETRY_BACKOFF_BASE", "2"))


def imap_retry_backoff_max_seconds() -> float:
    return float(os.getenv("EMAIL_IMAP_RETRY_BACKOFF_MAX", "60"))


def imap_ingestion_enabled() -> bool:
    return bool(email_user() and email_password())
