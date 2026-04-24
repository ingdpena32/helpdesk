"""Lógica de negocio de tickets: validaciones y orquestación (sin SQL directo)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.database.db import get_connection
from app.models.ticket import Ticket
from app.repositories import ticket_repository, user_repository

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


def normalize_priority_value(raw: str | None) -> str | None:
    """
    Unifica prioridad para la BD (solo inglés en CHECK).
    Acepta sinónimos en español por si el cliente los envía por error.
    """
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


def create_from_request(body: dict[str, Any]) -> tuple[int, dict]:
    """
    Crea un ticket a partir del JSON del cliente.
    Campos obligatorios: title, description, created_by, priority, category.
    """
    title = body.get("title")
    description = body.get("description")
    raw_created_by = body.get("created_by")
    priority = body.get("priority")
    category = body.get("category")

    if not isinstance(title, str) or not title.strip():
        return 400, {"error": "title es obligatorio y no puede estar vacío"}
    if not isinstance(description, str) or not description.strip():
        return 400, {"error": "description es obligatorio y no puede estar vacío"}
    if raw_created_by is None:
        return 400, {"error": "created_by es obligatorio (user_id entero)"}
    try:
        created_by = int(raw_created_by)
    except (TypeError, ValueError):
        return 400, {"error": "created_by debe ser un entero (user_id)"}
    if created_by < 1:
        return 400, {"error": "created_by debe ser un entero positivo"}

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
            creator = user_repository.find_by_id(conn, created_by)
            if creator is None:
                return 400, {"error": "created_by no corresponde a un usuario existente"}
            ticket = ticket_repository.insert(
                conn,
                title=title_clean,
                description=desc_clean,
                created_by=created_by,
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


def list_tickets(query: dict[str, str]) -> tuple[int, dict]:
    """Lista paginada compatible con el cliente (count, next, previous, results)."""
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
    # Sin URLs absolutas de API: next/previous en null si no aplica
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
