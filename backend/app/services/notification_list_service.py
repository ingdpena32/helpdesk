"""Listado y lectura de notificaciones."""

from __future__ import annotations

from typing import Any, Mapping

from app.database.db import get_connection
from app.repositories import notification_repository
from app.services import auth_service


def _parse_page(query: dict[str, str], *, default_size: int = 20, max_size: int = 50) -> tuple[int, int, int]:
    try:
        page = max(1, int(query.get("page") or "1"))
    except ValueError:
        page = 1
    try:
        page_size = int(query.get("page_size") or str(default_size))
    except ValueError:
        page_size = default_size
    page_size = max(1, min(page_size, max_size))
    offset = (page - 1) * page_size
    return page, page_size, offset


def list_notifications(headers: Mapping[str, str], query: dict[str, str]) -> tuple[int, dict]:
    page, limit, offset = _parse_page(query)
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            results, total = notification_repository.list_for_user(conn, user_id=user.id, limit=limit, offset=offset)
            next_q = f"?page={page + 1}&page_size={limit}" if offset + len(results) < total else None
            prev_q = f"?page={page - 1}&page_size={limit}" if page > 1 else None
    except Exception:
        return 500, {"error": "No se pudieron cargar las notificaciones."}

    return 200, {
        "count": total,
        "next": next_q,
        "previous": prev_q,
        "results": results,
    }


def unread_count(headers: Mapping[str, str]) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            n = notification_repository.count_unread(conn, user_id=user.id)
    except Exception:
        return 500, {"error": "No se pudo obtener el contador."}

    return 200, {"unread_count": n}


def mark_one_read(headers: Mapping[str, str], notification_id: int) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            ok = notification_repository.mark_read(conn, notification_id=notification_id, user_id=user.id)
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo marcar la notificación."}

    if not ok:
        return 404, {"error": "Notificación no encontrada"}
    return 200, {"status": "read", "id": notification_id}


def mark_all_read(headers: Mapping[str, str]) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            n = notification_repository.mark_all_read(conn, user_id=user.id)
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudieron marcar las notificaciones."}

    return 200, {"status": "read_all", "updated": n}
