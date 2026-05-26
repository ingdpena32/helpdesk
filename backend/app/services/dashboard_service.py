"""Agregaciones del panel de control (KPIs y desglose por agente)."""

from __future__ import annotations

from typing import Any, Mapping

from app.database.db import get_connection
from app.repositories import ticket_audit_repository, ticket_repository
from app.services import auth_service
from app.services.ticket_service import normalize_priority_value
from app.utils.date_params import parse_date_param

_STATUS_LABELS: dict[str, str] = {
    "open": "Abiertos",
    "in_progress": "En proceso",
    "closed": "Cerrados",
}

_STATUS_ORDER = ("open", "in_progress", "closed")

_STATUS_ES: dict[str, str] = {
    "open": "abierto",
    "in_progress": "en progreso",
    "closed": "cerrado",
}

_PRIORITY_ES: dict[str, str] = {
    "low": "baja",
    "medium": "media",
    "high": "alta",
    "critical": "crítica",
}


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


def _activity_summary(row: dict[str, Any]) -> str:
    actor = row.get("actor_name") or "Sistema"
    tid = row.get("ticket_id")
    et = row.get("event_type") or ""
    meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    target = row.get("target_name")

    if et == "ticket_created":
        return f"{actor} creó el ticket #{tid}"
    if et == "ticket_comment":
        return f"{actor} comentó en el ticket #{tid}"
    if et == "ticket_transfer":
        dest = target or "otro usuario"
        return f"{actor} transfirió el ticket #{tid} a {dest}"
    if et == "ticket_updated":
        parts: list[str] = []
        status_chg = meta.get("status")
        if isinstance(status_chg, dict) and "to" in status_chg:
            to_val = str(status_chg["to"])
            label = _STATUS_ES.get(to_val, to_val)
            if to_val == "closed":
                parts.append("cerró el ticket")
            else:
                parts.append(f"estado → {label}")
        if "assigned_to" in meta:
            parts.append("reasignó el ticket")
        pri = meta.get("priority")
        if isinstance(pri, dict) and "to" in pri:
            to_p = str(pri["to"])
            parts.append(f"prioridad → {_PRIORITY_ES.get(to_p, to_p)}")
        cat = meta.get("category")
        if isinstance(cat, dict) and "to" in cat:
            parts.append(f"categoría → {cat['to']}")
        ai = meta.get("ai_status")
        if isinstance(ai, dict) and "to" in ai:
            parts.append(f"IA → {ai['to']}")
        if "resolution" in meta:
            parts.append("actualizó la resolución")
        if parts:
            return f"{actor} — {', '.join(parts)} (#{tid})"
        return f"{actor} actualizó el ticket #{tid}"
    return f"{actor} — actividad en el ticket #{tid}"


def get_recent_activity(headers: Mapping[str, str], query: dict[str, str]) -> tuple[int, dict]:
    limit_raw = query.get("limit", "15")
    try:
        limit = max(1, min(int(limit_raw), 50))
    except ValueError:
        limit = 15

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

            ticket_conds, ticket_params = ticket_repository._ticket_list_conditions(
                priority=filters.get("priority"),
                assigned_to=filters.get("assigned_to"),
                category=filters.get("category"),
                table_alias="t",
            )

            rows = ticket_audit_repository.list_dashboard_activity(
                conn,
                ticket_conditions=(ticket_conds, ticket_params),
                activity_from=filters.get("created_from"),
                activity_to=filters.get("created_to"),
                limit=limit,
            )
    except Exception:
        return 500, {"error": "No se pudo obtener la actividad reciente."}

    results = []
    for row in rows:
        title = str(row.get("ticket_title") or "")
        short = title if len(title) <= 72 else f"{title[:69]}…"
        results.append(
            {
                "id": row["id"],
                "ticket_id": row["ticket_id"],
                "event_type": row["event_type"],
                "occurred_at": row["occurred_at"],
                "actor_name": row["actor_name"],
                "ticket_title": short,
                "summary": _activity_summary(row),
            }
        )

    return 200, {"results": results}
