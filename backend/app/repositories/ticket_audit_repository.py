"""Auditoría de tickets (transferencias, etc.)."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from psycopg2.extensions import connection as PGConnection


def insert_event(
    conn: PGConnection,
    *,
    ticket_id: int,
    event_type: str,
    actor_user_id: int | None,
    metadata: dict[str, Any],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ticket_audit_events (ticket_id, event_type, actor_user_id, metadata)
            VALUES (%s, %s, %s, %s::jsonb)
            """,
            (ticket_id, event_type, actor_user_id, json.dumps(metadata)),
        )


def list_for_ticket(conn: PGConnection, ticket_id: int, *, limit: int = 50) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, ticket_id, event_type, actor_user_id, metadata, created_at
            FROM ticket_audit_events
            WHERE ticket_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (ticket_id, limit),
        )
        rows = cur.fetchall()
    out: list[dict[str, Any]] = []
    for eid, tid, etype, actor, meta, created in rows:
        out.append(
            {
                "id": int(eid),
                "ticket_id": int(tid),
                "event_type": str(etype),
                "actor_user_id": int(actor) if actor is not None else None,
                "metadata": meta if isinstance(meta, dict) else {},
                "created_at": created.isoformat() if isinstance(created, datetime) else created,
            }
        )
    return out


def list_dashboard_activity(
    conn: PGConnection,
    *,
    ticket_conditions: tuple[list[str], list[Any]],
    activity_from: datetime | None = None,
    activity_to: datetime | None = None,
    limit: int = 15,
) -> list[dict[str, Any]]:
    """
    Feed unificado: auditoría, comentarios y creación de tickets.
    ticket_conditions: cláusulas sobre alias t (sin filtro de fecha de ticket).
    """
    conds, t_params = ticket_conditions
    ticket_where = " AND ".join(conds)
    limit = max(1, min(limit, 50))

    outer_conds: list[str] = []
    outer_params: list[Any] = []
    if activity_from is not None:
        outer_conds.append("feed.occurred_at >= %s")
        outer_params.append(activity_from)
    if activity_to is not None:
        outer_conds.append("feed.occurred_at <= %s")
        outer_params.append(activity_to)
    outer_sql = (" WHERE " + " AND ".join(outer_conds)) if outer_conds else ""

    sql = f"""
        SELECT
            feed.activity_id,
            feed.ticket_id,
            feed.event_type,
            feed.actor_user_id,
            feed.actor_name,
            feed.ticket_title,
            feed.metadata,
            feed.occurred_at,
            feed.target_name
        FROM (
            SELECT
                ('audit-' || e.id::text) AS activity_id,
                e.ticket_id,
                e.event_type,
                e.actor_user_id,
                COALESCE(
                    NULLIF(TRIM(actor.full_name), ''),
                    NULLIF(TRIM(actor.email), ''),
                    'Sistema'
                ) AS actor_name,
                t.title AS ticket_title,
                e.metadata,
                e.created_at AS occurred_at,
                COALESCE(
                    NULLIF(TRIM(dest.full_name), ''),
                    NULLIF(TRIM(dest.email), '')
                ) AS target_name
            FROM ticket_audit_events e
            INNER JOIN tickets t ON t.id = e.ticket_id
            LEFT JOIN users actor ON actor.id = e.actor_user_id
            LEFT JOIN users dest ON dest.id = (e.metadata->>'to_user_id')::int
            WHERE {ticket_where}

            UNION ALL

            SELECT
                ('comment-' || c.id::text) AS activity_id,
                c.ticket_id,
                'ticket_comment'::text AS event_type,
                c.user_id AS actor_user_id,
                COALESCE(
                    NULLIF(TRIM(actor.full_name), ''),
                    NULLIF(TRIM(actor.email), ''),
                    NULLIF(TRIM(c.author_email), ''),
                    'Correo'
                ) AS actor_name,
                t.title AS ticket_title,
                jsonb_build_object('preview', LEFT(c.body, 200)) AS metadata,
                c.created_at AS occurred_at,
                NULL::text AS target_name
            FROM ticket_comments c
            INNER JOIN tickets t ON t.id = c.ticket_id
            LEFT JOIN users actor ON actor.id = c.user_id
            WHERE {ticket_where}

            UNION ALL

            SELECT
                ('created-' || t.id::text) AS activity_id,
                t.id AS ticket_id,
                'ticket_created'::text AS event_type,
                t.created_by AS actor_user_id,
                COALESCE(
                    NULLIF(TRIM(creator.full_name), ''),
                    NULLIF(TRIM(creator.email), ''),
                    'Sistema'
                ) AS actor_name,
                t.title AS ticket_title,
                '{{}}'::jsonb AS metadata,
                t.created_at AS occurred_at,
                NULL::text AS target_name
            FROM tickets t
            LEFT JOIN users creator ON creator.id = t.created_by
            WHERE {ticket_where}
        ) feed
        {outer_sql}
        ORDER BY feed.occurred_at DESC
        LIMIT %s
    """
    params: list[Any] = [*t_params, *t_params, *t_params, *outer_params, limit]
    with conn.cursor() as cur:
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

    out: list[dict[str, Any]] = []
    for (
        activity_id,
        ticket_id,
        event_type,
        actor_user_id,
        actor_name,
        ticket_title,
        metadata,
        occurred_at,
        target_name,
    ) in rows:
        meta = metadata if isinstance(metadata, dict) else {}
        out.append(
            {
                "id": str(activity_id),
                "ticket_id": int(ticket_id),
                "event_type": str(event_type),
                "actor_user_id": int(actor_user_id) if actor_user_id is not None else None,
                "actor_name": str(actor_name),
                "ticket_title": str(ticket_title),
                "metadata": meta,
                "occurred_at": occurred_at.isoformat() if isinstance(occurred_at, datetime) else occurred_at,
                "target_name": str(target_name) if target_name else None,
            }
        )
    return out
