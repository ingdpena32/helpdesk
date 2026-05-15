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
