"""Descarga de adjuntos con autorización."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

from app.database.db import get_connection
from app.repositories import ticket_attachment_repository, ticket_repository
from app.services import auth_service
from app.utils.response import BinaryPayload


_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def _resolve_storage_path(storage_path: str) -> Path:
    p = Path(storage_path)
    if p.is_absolute():
        return p
    return _BACKEND_ROOT / p


def download_attachment(headers: Mapping[str, str], attachment_id: int) -> tuple[int, dict[str, Any] | BinaryPayload]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            row = ticket_attachment_repository.find_by_id(conn, attachment_id)
            if row is None:
                return 404, {"error": "Adjunto no encontrado"}

            ticket = ticket_repository.find_by_id(conn, row.ticket_id)
            if ticket is None:
                return 404, {"error": "Ticket no encontrado"}

            path = _resolve_storage_path(row.storage_path)
            if not path.is_file():
                return 404, {"error": "Fichero no disponible en disco"}

            data = path.read_bytes()
    except Exception:
        return 500, {"error": "No se pudo leer el adjunto"}

    return 200, BinaryPayload(
        body=data,
        content_type=row.mime_type or "application/octet-stream",
        filename=row.original_filename,
    )


def list_for_ticket_json(headers: Mapping[str, str], ticket_id: int) -> tuple[int, dict[str, Any]]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            if ticket_repository.find_by_id(conn, ticket_id) is None:
                return 404, {"error": "Ticket no encontrado"}

            rows = ticket_attachment_repository.list_by_ticket(conn, ticket_id)
    except Exception:
        return 500, {"error": "No se pudieron listar adjuntos"}

    results: list[dict[str, Any]] = []
    for a in rows:
        results.append(
            {
                "id": a.id,
                "ticket_id": a.ticket_id,
                "comment_id": a.comment_id,
                "original_filename": a.original_filename,
                "mime_type": a.mime_type,
                "size_bytes": a.size_bytes,
                "download_url": f"/api/attachments/{a.id}",
            }
        )
    return 200, {"results": results}
