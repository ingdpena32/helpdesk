"""CRUD de categorías de ticket."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Mapping

from app.auth import permissions
from app.database.db import get_connection
from app.repositories import category_repository
from app.services import auth_service

_NAME_MIN = 2
_NAME_MAX = 80
_INVALID_NAME_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _category_to_json(c) -> dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "created_at": c.created_at.isoformat() if isinstance(c.created_at, datetime) else c.created_at,
        "updated_at": c.updated_at.isoformat() if isinstance(c.updated_at, datetime) else c.updated_at,
    }


def normalize_category_name(raw: str | None) -> tuple[str | None, str | None]:
    if raw is None or not isinstance(raw, str):
        return None, "name debe ser texto"
    cleaned = " ".join(raw.strip().split())
    if not cleaned:
        return None, "name no puede estar vacío"
    if len(cleaned) < _NAME_MIN:
        return None, f"name debe tener al menos {_NAME_MIN} caracteres"
    if len(cleaned) > _NAME_MAX:
        return None, f"name no puede superar {_NAME_MAX} caracteres"
    if _INVALID_NAME_RE.search(cleaned):
        return None, "name contiene caracteres no válidos"
    return cleaned, None


def list_categories(headers: Mapping[str, str]) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            items = category_repository.list_all(conn)
    except Exception:
        return 500, {"error": "No se pudieron listar las categorías."}
    return 200, {"results": [_category_to_json(c) for c in items]}


def create_category(headers: Mapping[str, str], body: dict[str, Any] | None) -> tuple[int, dict]:
    if body is None:
        body = {}
    name, err = normalize_category_name(body.get("name"))
    if err:
        return 400, {"error": err}

    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.can_manage_categories(user.role):
                return 403, {"error": "Solo administradores pueden gestionar categorías"}

            assert name is not None
            if category_repository.name_exists_ci(conn, name):
                return 409, {"error": "Ya existe una categoría con ese nombre"}

            created = category_repository.insert(conn, name)
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo crear la categoría."}

    return 201, _category_to_json(created)


def update_category(
    headers: Mapping[str, str], category_id: int, body: dict[str, Any] | None
) -> tuple[int, dict]:
    if body is None:
        body = {}
    name, err = normalize_category_name(body.get("name"))
    if err:
        return 400, {"error": err}

    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.can_manage_categories(user.role):
                return 403, {"error": "Solo administradores pueden gestionar categorías"}

            existing = category_repository.find_by_id(conn, category_id)
            if existing is None:
                return 404, {"error": "Categoría no encontrada"}

            assert name is not None
            if category_repository.name_exists_ci(conn, name, exclude_id=category_id):
                return 409, {"error": "Ya existe una categoría con ese nombre"}

            updated = category_repository.update_name(conn, category_id, name)
            if updated is None:
                return 404, {"error": "Categoría no encontrada"}
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo actualizar la categoría."}

    return 200, _category_to_json(updated)


def delete_category(headers: Mapping[str, str], category_id: int) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.can_manage_categories(user.role):
                return 403, {"error": "Solo administradores pueden gestionar categorías"}

            existing = category_repository.find_by_id(conn, category_id)
            if existing is None:
                return 404, {"error": "Categoría no encontrada"}

            in_use = category_repository.count_tickets_with_name(conn, existing.name)
            if in_use > 0:
                return 409, {
                    "error": f"No se puede eliminar: {in_use} ticket(s) usan esta categoría.",
                    "ticket_count": in_use,
                }

            deleted = category_repository.delete_by_id(conn, category_id)
            if not deleted:
                return 404, {"error": "Categoría no encontrada"}
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo eliminar la categoría."}

    return 200, {"status": "deleted", "id": category_id}


def validate_ticket_category(conn, category: str) -> tuple[bool, str | None]:
    """Comprueba que el nombre exista en el catálogo."""
    cleaned = category.strip()
    if not cleaned:
        return False, "category no puede estar vacía"
    cat = category_repository.find_by_name_ci(conn, cleaned)
    if cat is None:
        return False, "category debe ser una categoría existente en el sistema"
    return True, cat.name
