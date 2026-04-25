"""Lógica de negocio de tickets: validaciones y orquestación (sin SQL directo)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping

from app.database.db import get_connection
from app.models.ticket import Ticket
from app.repositories import ticket_comment_repository, ticket_repository, user_repository
from app.services import auth_service

ALLOWED_CATEGORIES: frozenset[str] = frozenset(
    {
        "ERP",
        "Infraestructura",
        "Soporte técnico",
        "Bases de datos",
        "Desarrollo",
    }
)

ALLOWED_PRIORITIES: frozenset[str] = frozenset({"low", "medium", "high"})
ALLOWED_STATUS: frozenset[str] = frozenset({"open", "in_progress", "closed"})


def normalize_priority_value(raw: str | None) -> str | None:
    if raw is None or not isinstance(raw, str):
        return None
    key = raw.strip().lower()
    aliases: dict[str, str] = {
        "low": "low",
        "medium": "medium",
        "high": "high",
        "baja": "low",
        "media": "medium",
        "alta": "high",
    }
    return aliases.get(key)


def _ticket_to_json(t: Ticket) -> dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "created_by": t.created_by,
        "priority": t.priority,
        "category": t.category,
        "status": t.status,
        "created_at": t.created_at.isoformat() if isinstance(t.created_at, datetime) else t.created_at,
        "updated_at": t.updated_at.isoformat() if isinstance(t.updated_at, datetime) else t.updated_at,
        "assigned_to": t.assigned_to,
        "resolution": t.resolution,
        "closed_at": t.closed_at.isoformat() if t.closed_at else None,
    }


def create_from_request(headers: Mapping[str, str], body: dict[str, Any]) -> tuple[int, dict]:
    """
    Crea un ticket. El creador es siempre el usuario autenticado (no se usa created_by del body).
    """
    title = body.get("title")
    description = body.get("description")
    priority = body.get("priority")
    category = body.get("category")

    if not isinstance(title, str) or not title.strip():
        return 400, {"error": "title es obligatorio y no puede estar vacío"}
    if not isinstance(description, str) or not description.strip():
        return 400, {"error": "description es obligatorio y no puede estar vacío"}

    if not isinstance(priority, str):
        return 400, {"error": "priority debe ser texto (low/medium/high o baja/media/alta)"}
    priority_canon = normalize_priority_value(priority)
    if priority_canon not in ALLOWED_PRIORITIES:
        return 400, {
            "error": "priority debe ser uno de: low, medium, high (o baja, media, alta en español)",
        }

    if not isinstance(category, str):
        return 400, {"error": "category debe ser texto"}
    category_clean = category.strip()
    if category_clean not in ALLOWED_CATEGORIES:
        return 400, {
            "error": "category debe ser una de: ERP, Infraestructura, Soporte técnico, Bases de datos, Desarrollo",
        }

    title_clean = title.strip()
    desc_clean = description.strip()

    try:
        with get_connection() as conn:
            actor, err_status, err_body = auth_service.require_user(conn, headers)
            if actor is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            ticket = ticket_repository.insert(
                conn,
                title=title_clean,
                description=desc_clean,
                created_by=actor.id,
                priority=priority_canon,
                category=category_clean,
            )
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo crear el ticket. Intente más tarde."}

    return 201, _ticket_to_json(ticket)


def _parse_positive_int(value: str | None, default: int, *, maximum: int | None = None) -> int:
    if value is None or value == "":
        return default
    try:
        n = int(value)
    except ValueError:
        return default
    if n < 1:
        return default
    if maximum is not None and n > maximum:
        return maximum
    return n


def list_tickets(headers: Mapping[str, str], query: dict[str, str]) -> tuple[int, dict]:
    page = _parse_positive_int(query.get("page"), 1)
    page_size = _parse_positive_int(query.get("page_size"), 20, maximum=100)
    offset = (page - 1) * page_size

    status = query.get("status") or None
    priority_raw = query.get("priority") or None
    priority = normalize_priority_value(priority_raw) if priority_raw else None
    if priority_raw and priority is None:
        priority = priority_raw.strip() or None
    category = query.get("category") or None
    assigned_raw = query.get("assigned_to")
    assigned_to: int | None = None
    if assigned_raw not in (None, ""):
        try:
            assigned_to = int(assigned_raw)
        except ValueError:
            assigned_to = None

    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            total = ticket_repository.count_filtered(
                conn,
                status=status,
                priority=priority,
                assigned_to=assigned_to,
                category=category,
            )
            rows = ticket_repository.list_filtered(
                conn,
                status=status,
                priority=priority,
                assigned_to=assigned_to,
                category=category,
                limit=page_size,
                offset=offset,
            )
    except Exception:
        return 500, {"error": "No se pudo listar los tickets."}

    results = [_ticket_to_json(t) for t in rows]
    next_url: str | None = None
    previous_url: str | None = None
    if offset + len(results) < total:
        next_url = f"?page={page + 1}&page_size={page_size}"
    if page > 1:
        previous_url = f"?page={page - 1}&page_size={page_size}"

    return 200, {
        "count": total,
        "next": next_url,
        "previous": previous_url,
        "results": results,
    }


def get_ticket(headers: Mapping[str, str], ticket_id: int) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            ticket = ticket_repository.find_by_id(conn, ticket_id)
            if ticket is None:
                return 404, {"error": "Ticket no encontrado"}
    except Exception:
        return 500, {"error": "No se pudo obtener el ticket."}

    return 200, _ticket_to_json(ticket)


def _is_admin(role: str) -> bool:
    return (role or "").strip().lower() == "admin"


def soft_delete_ticket(headers: Mapping[str, str], ticket_id: int) -> tuple[int, dict]:
    """DELETE /api/tickets/{id} — solo admin; soft delete."""
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not _is_admin(user.role):
                return 403, {"error": "Solo administradores pueden eliminar tickets"}

            outcome = ticket_repository.soft_delete(conn, ticket_id)
            if outcome == "not_found":
                conn.rollback()
                return 404, {"error": "Ticket no encontrado"}
            if outcome == "already_deleted":
                conn.rollback()
                return 409, {"error": "El ticket ya estaba eliminado"}
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo eliminar el ticket."}

    return 200, {"status": "deleted", "id": ticket_id}


def _assignee_allowed(conn, assignee_id: int) -> bool:
    u = user_repository.find_by_id(conn, assignee_id)
    if u is None:
        return False
    role = (u.role or "").strip().lower()
    return role in ("agent", "admin")


def patch_ticket(headers: Mapping[str, str], ticket_id: int, body: dict[str, Any] | None) -> tuple[int, dict]:
    if body is None:
        body = {}

    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            ticket = ticket_repository.find_by_id(conn, ticket_id)
            if ticket is None:
                return 404, {"error": "Ticket no encontrado"}

            new_status = ticket.status
            if "status" in body:
                raw_s = body.get("status")
                if not isinstance(raw_s, str) or raw_s.strip() not in ALLOWED_STATUS:
                    return 400, {"error": "status debe ser open, in_progress o closed"}
                new_status = raw_s.strip()

            new_assigned = ticket.assigned_to
            if "assigned_to" in body:
                raw_a = body.get("assigned_to")
                if raw_a is None:
                    new_assigned = None
                else:
                    if isinstance(raw_a, bool):
                        return 400, {"error": "assigned_to debe ser un entero o null"}
                    if isinstance(raw_a, int):
                        aid = int(raw_a)
                    elif isinstance(raw_a, float) and raw_a.is_integer():
                        aid = int(raw_a)
                    elif isinstance(raw_a, str) and raw_a.strip().lstrip("-").isdigit():
                        aid = int(raw_a.strip())
                    else:
                        return 400, {"error": "assigned_to debe ser un entero o null"}
                    if aid < 1:
                        return 400, {"error": "assigned_to inválido"}
                    if not _assignee_allowed(conn, aid):
                        return 400, {"error": "assigned_to debe ser un usuario agente o administrador existente"}
                    new_assigned = int(aid)

            new_resolution = ticket.resolution
            if "resolution" in body:
                r = body.get("resolution")
                if r is None:
                    new_resolution = None
                elif isinstance(r, str):
                    new_resolution = r.strip() or None
                else:
                    return 400, {"error": "resolution debe ser texto o null"}

            if new_status == "closed":
                effective = (new_resolution or "").strip()
                if not effective:
                    return 400, {"error": "No se puede cerrar un ticket sin resolución"}

            now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
            if new_status == "closed":
                closed_at = now_naive
            else:
                closed_at = None

            updated = ticket_repository.update_fields(
                conn,
                ticket_id,
                status=new_status,
                assigned_to=new_assigned,
                resolution=new_resolution,
                closed_at=closed_at,
            )
            if updated is None:
                conn.rollback()
                return 404, {"error": "Ticket no encontrado"}

            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo actualizar el ticket."}

    return 200, _ticket_to_json(updated)


def list_comments(headers: Mapping[str, str], ticket_id: int) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            if ticket_repository.find_by_id(conn, ticket_id) is None:
                return 404, {"error": "Ticket no encontrado"}

            rows = ticket_comment_repository.list_by_ticket_with_author_email(conn, ticket_id)
    except Exception:
        return 500, {"error": "No se pudieron listar los comentarios."}

    results: list[dict[str, Any]] = []
    for c, email in rows:
        results.append(
            {
                "id": c.id,
                "user_id": c.user_id,
                "username": email,
                "content": c.body,
                "created_at": c.created_at.isoformat()
                if isinstance(c.created_at, datetime)
                else c.created_at,
            }
        )
    return 200, {"results": results}


def add_comment(headers: Mapping[str, str], ticket_id: int, body: dict[str, Any] | None) -> tuple[int, dict]:
    if body is None:
        body = {}

    content = body.get("content")
    if not isinstance(content, str) or not content.strip():
        return 400, {"error": "content es obligatorio y no puede estar vacío"}

    text = content.strip()
    if len(text) > 8000:
        return 400, {"error": "content demasiado largo"}

    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            if ticket_repository.find_by_id(conn, ticket_id) is None:
                return 404, {"error": "Ticket no encontrado"}

            c = ticket_comment_repository.insert(conn, ticket_id=ticket_id, user_id=user.id, body=text)
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo crear el comentario."}

    out = {
        "id": c.id,
        "user_id": c.user_id,
        "username": user.email,
        "content": c.body,
        "created_at": c.created_at.isoformat() if isinstance(c.created_at, datetime) else c.created_at,
    }
    return 201, out
