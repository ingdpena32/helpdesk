"""Agregaciones del panel de control (KPIs y desglose por agente)."""

from __future__ import annotations

from typing import Any, Mapping

from app.database.db import get_connection
from app.repositories import ticket_repository
from app.services import auth_service
from app.services.ticket_service import normalize_priority_value
from app.utils.date_params import parse_date_param

_STATUS_LABELS: dict[str, str] = {
    "open": "Abiertos",
    "in_progress": "En proceso",
    "closed": "Cerrados",
}

_STATUS_ORDER = ("open", "in_progress", "closed")


def _parse_dashboard_filters(
    query: dict[str, str], *, user_role: str, user_id: int
) -> tuple[dict[str, Any] | None, int, dict]:
    """Devuelve (filtros, error_status, error_body)."""
    priority_raw = query.get("priority") or None
    priority = normalize_priority_value(priority_raw) if priority_raw else None
    if priority_raw and priority is None:
        priority = priority_raw.strip() or None

    category = (query.get("category") or "").strip() or None

    assigned_to: int | None = None
    if user_role == "agent":
        assigned_to = user_id
    else:
        assigned_raw = query.get("assigned_to")
        if assigned_raw not in (None, ""):
            try:
                assigned_to = int(assigned_raw)
            except ValueError:
                return None, 400, {"error": "assigned_to inválido"}

    created_from = parse_date_param(query.get("created_from") or query.get("date_from"))
    created_to = parse_date_param(query.get("created_to") or query.get("date_to"), end_of_day=True)
    if created_from and created_to and created_from > created_to:
        return None, 400, {"error": "created_from no puede ser posterior a created_to"}

    return (
        {
            "priority": priority,
            "assigned_to": assigned_to,
            "category": category,
            "created_from": created_from,
            "created_to": created_to,
        },
        0,
        {},
    )


def get_stats(headers: Mapping[str, str], query: dict[str, str]) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            filters, f_err, f_body = _parse_dashboard_filters(
                query, user_role=user.role, user_id=user.id
            )
            if filters is None:
                return f_err, f_body

            raw = ticket_repository.dashboard_stats(conn, **filters)
    except Exception:
        return 500, {"error": "No se pudieron calcular las estadísticas del dashboard."}

    return 200, {
        "total": raw["total"],
        "open": raw["open"],
        "in_progress": raw["in_progress"],
        "closed": raw["closed"],
        "high_priority": raw["high_priority"],
        "avg_resolution_hours": raw["avg_resolution_hours"],
    }


def get_agent_breakdown(headers: Mapping[str, str], query: dict[str, str]) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            filters, f_err, f_body = _parse_dashboard_filters(
                query, user_role=user.role, user_id=user.id
            )
            if filters is None:
                return f_err, f_body

            rows = ticket_repository.tickets_by_agent_and_status(conn, **filters)
    except Exception:
        return 500, {"error": "No se pudo obtener el desglose por agente."}

    agent_map: dict[str, dict[str, Any]] = {}
    statuses_seen: set[str] = set()

    for agent_id, label, status, count in rows:
        key = str(agent_id) if agent_id is not None else "unassigned"
        if key not in agent_map:
            agent_map[key] = {
                "agent_id": agent_id,
                "agent_name": label,
                "by_status": {},
                "total": 0,
            }
        agent_map[key]["by_status"][status] = count
        agent_map[key]["total"] += count
        statuses_seen.add(status)

    ordered_statuses = [s for s in _STATUS_ORDER if s in statuses_seen]
    for s in sorted(statuses_seen - set(_STATUS_ORDER)):
        ordered_statuses.append(s)

    agents = sorted(agent_map.values(), key=lambda a: (-int(a["total"]), str(a["agent_name"])))

    return 200, {
        "agents": agents,
        "statuses": ordered_statuses,
        "status_labels": {
            **{s: _STATUS_LABELS[s] for s in ordered_statuses if s in _STATUS_LABELS},
            **{s: s.replace("_", " ").title() for s in ordered_statuses if s not in _STATUS_LABELS},
        },
    }
