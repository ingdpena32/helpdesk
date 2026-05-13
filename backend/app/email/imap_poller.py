"""
Poll IMAP (Gmail u otro servidor), inserta mensajes UNSEEN en ingestion_events
y marca leídos tras persistir. El worker existente procesa el staging.

Cada ciclo de sondeo abre una conexión nueva (no persistente). Ante IMAP4.abort,
EOF, timeouts o desconexiones se reintenta con backoff exponencial.

    python -m app.email.imap_poller
"""

from __future__ import annotations

import base64
import imaplib
import socket
import ssl
import time
import traceback
from typing import Any

import psycopg2.errors

from app.database.db import get_connection
from app.email import config as email_config
from app.email.message_normalize import message_id_from_raw_mime
from app.repositories import ingestion_repository


def _rfc822_from_fetch(fetch_data: Any) -> bytes | None:
    if not fetch_data:
        return None
    for item in fetch_data:
        if isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], bytes):
            return item[1]
    return None


def _safe_close_imap(mail: imaplib.IMAP4_SSL | None) -> None:
    """Cierra la sesión IMAP de forma tolerante a socket ya cortado."""
    if mail is None:
        return
    try:
        mail.logout()
    except Exception:
        pass
    try:
        mail.shutdown()
    except Exception:
        pass


def _is_transient_imap_error(exc: BaseException) -> bool:
    """Errores típicos de Gmail/servidor o red que merecen reintento con nueva conexión."""
    if isinstance(exc, imaplib.IMAP4.abort):
        return True
    if isinstance(exc, TimeoutError):
        return True
    if isinstance(exc, (BrokenPipeError, ConnectionAbortedError, ConnectionResetError)):
        return True
    if isinstance(exc, OSError):
        # p. ej. WinError 10054, errno.ECONNRESET, "EOF occurred in violation of protocol"
        return True
    if isinstance(exc, ssl.SSLError):
        return True
    if isinstance(exc, socket.timeout):
        return True
    if isinstance(exc, imaplib.IMAP4.error):
        msg = str(exc).upper()
        if "EOF" in msg or "SOCKET" in msg or "TIMEOUT" in msg or "ABORT" in msg:
            return True
    return False


def _is_auth_failure(exc: BaseException) -> bool:
    s = str(exc).lower()
    if "authenticationfailed" in s or "authentication failed" in s:
        return True
    if "invalid credentials" in s or "username and password not accepted" in s:
        return True
    return "login failed" in s or "auth" in s and "fail" in s


def _mark_seen(mail: imaplib.IMAP4_SSL, num: bytes) -> None:
    try:
        mail.store(num, "+FLAGS", "\\Seen")
    except Exception:
        pass


def _process_unseen_message(mail: imaplib.IMAP4_SSL, num: bytes) -> None:
    typ, data = mail.fetch(num, "(BODY.PEEK[])")
    if typ != "OK" or not data:
        return
    raw = _rfc822_from_fetch(data)
    if not raw:
        return

    max_b = email_config.max_payload_bytes()
    b64 = base64.standard_b64encode(raw).decode("ascii")
    if len(b64) > max_b:
        _mark_seen(mail, num)
        print(f"IMAP: mensaje demasiado grande (>{max_b} bytes base64), marcado leído: {num!r}")
        return

    mid_hint = message_id_from_raw_mime(raw)
    payload: dict[str, Any] = {"source": "imap", "raw_mime_b64": b64}

    try:
        with get_connection() as conn:
            if mid_hint and ingestion_repository.try_find_completed_by_message_id(conn, mid_hint):
                conn.commit()
                _mark_seen(mail, num)
                return

            try:
                ingestion_repository.insert_event(conn, payload=payload, message_id_hint=mid_hint)
                conn.commit()
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
            _mark_seen(mail, num)
    except Exception as ex:
        print(f"IMAP: error guardando evento {num!r}: {ex}")
        traceback.print_exc()


def _run_single_imap_session() -> int:
    """
    Una conexión IMAP desde login hasta procesar todos los UNSEEN del buzón.
    Cierra siempre la conexión al salir (éxito o error).
    """
    timeout = email_config.imap_socket_timeout_seconds()
    mail = imaplib.IMAP4_SSL(
        email_config.imap_server(),
        email_config.imap_port(),
        timeout=timeout,
    )
    try:
        mail.login(email_config.email_user(), email_config.email_password())
        typ, _ = mail.select(email_config.imap_mailbox(), readonly=False)
        if typ != "OK":
            print(f"IMAP: no se pudo seleccionar buzón {email_config.imap_mailbox()!r}")
            return 0

        typ, data = mail.search(None, "UNSEEN")
        if typ != "OK" or not data or not data[0]:
            return 0

        ids = data[0].split()
        for num in ids:
            _process_unseen_message(mail, num)
        return len(ids)
    finally:
        _safe_close_imap(mail)


def poll_once() -> int:
    """
    Un ciclo de sondeo: nueva conexión por intento; reintentos con backoff ante
    errores transitorios (abort, EOF, timeouts, desconexiones).
    """
    if not email_config.imap_ingestion_enabled():
        return 0

    max_attempts = max(1, email_config.imap_max_retries_per_cycle())
    base = max(0.5, email_config.imap_retry_backoff_base_seconds())
    cap = max(base, email_config.imap_retry_backoff_max_seconds())

    last_error: BaseException | None = None
    backoff = base

    for attempt in range(1, max_attempts + 1):
        try:
            n = _run_single_imap_session()
            if attempt > 1:
                print("IMAP: conexión restablecida; ciclo completado correctamente")
            return n
        except Exception as ex:
            last_error = ex

            if _is_auth_failure(ex):
                print(f"IMAP: error de autenticación (no se reintenta): {ex}")
                traceback.print_exc()
                return 0

            if not _is_transient_imap_error(ex):
                print(f"IMAP: error no transitorio: {ex}")
                traceback.print_exc()
                return 0

            if attempt >= max_attempts:
                print(
                    f"IMAP: error temporal IMAP tras {max_attempts} intento(s): {ex!r}. "
                    "Se reintentará en el siguiente ciclo de poll."
                )
                traceback.print_exc()
                return 0

            print(
                f"IMAP: error temporal IMAP ({ex!r}); reconectando en {backoff:.1f}s "
                f"(intento {attempt}/{max_attempts})…"
            )
            time.sleep(min(backoff, cap))
            backoff = min(backoff * 2.0, cap)

    if last_error is not None:
        print(f"IMAP: ciclo abortado: {last_error!r}")
    return 0


def run_loop() -> None:
    poll = email_config.imap_poll_seconds()
    if not email_config.imap_ingestion_enabled():
        print(
            "IMAP: defina EMAIL_USER y EMAIL_PASSWORD en backend/.env para activar la ingesta."
        )
        return

    to = email_config.imap_socket_timeout_seconds()
    print(
        f"IMAP: {email_config.email_user()} @ {email_config.imap_server()}:{email_config.imap_port()} "
        f"mailbox={email_config.imap_mailbox()!r}, poll cada {poll}s, timeout socket {to}s "
        f"(nueva conexión por ciclo; reintentos con backoff dentro del ciclo)"
    )
    while True:
        try:
            n = poll_once()
            if n:
                print(f"IMAP: ciclo con hasta {n} mensaje(s) no leídos")
        except Exception:
            print("IMAP: error inesperado en run_loop (no detiene el proceso)")
            traceback.print_exc()
        time.sleep(poll)


if __name__ == "__main__":
    run_loop()
