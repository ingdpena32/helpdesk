"""Persistencia de notificaciones (campana / UI)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from psycopg2.extensions import connection as PGConnection


def insert_many(
    conn: PGConnection,
    rows: list[tuple[int, int, str, str, str]],
) -> None:
    """Filas: (user_id, ticket_id, type, title, message)."""
    if not rows:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO notifications (user_id, ticket_id, type, title, message)
            VALUES (%s, %s, %s, %s, %s)
            """,
            rows,
        )


def count_unread(conn: PGConnection, *, user_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)::int FROM notifications
            WHERE user_id = %s AND NOT is_read
            """,
            (user_id,),
        )
        row = cur.fetchone()
    return int(row[0]) if row else 0


def list_for_user(
    conn: PGConnection,
    *,
    user_id: int,
    limit: int,
    offset: int,
) -> tuple[list[dict[str, Any]], int]:
    """Lista notificaciones con datos actuales del ticket (prioridad, asignado)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)::int FROM notifications n
            JOIN tickets t ON t.id = n.ticket_id AND t.deleted_at IS NULL
            WHERE n.user_id = %s
            """,
            (user_id,),
        )
        total_row = cur.fetchone()
        total = int(total_row[0]) if total_row else 0

        cur.execute(
            """
            SELECT
                n.id,
                n.ticket_id,
                n.type,
                n.title,
                n.message,
                n.is_read,
                n.created_at,
                t.priority,
                t.assigned_to,
                ua.email AS assignee_email
            FROM notifications n
            JOIN tickets t ON t.id = n.ticket_id AND t.deleted_at IS NULL
            LEFT JOIN users ua ON ua.id = t.assigned_to
            WHERE n.user_id = %s
            ORDER BY n.created_at DESC, n.id DESC
            LIMIT %s OFFSET %s
            """,
            (user_id, limit, offset),
        )
        rows = cur.fetchall()

    out: list[dict[str, Any]] = []
    for row in rows:
        nid, tid, typ, title, msg, is_read, created_at, prio, asto, aemail = row
        out.append(
            {
                "id": int(nid),
                "ticket_id": int(tid),
                "type": str(typ),
                "title": str(title),
                "message": str(msg),
                "is_read": bool(is_read),
                "created_at": created_at.isoformat()
                if isinstance(created_at, datetime)
                else str(created_at),
                "priority": str(prio) if prio is not None else None,
                "assigned_to": int(asto) if asto is not None else None,
                "assignee_email": str(aemail) if aemail else None,
            }
        )
    return out, total


def mark_read(conn: PGConnection, *, notification_id: int, user_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = %s AND user_id = %s
            RETURNING id
            """,
            (notification_id, user_id),
        )
        return cur.fetchone() is not None


def mark_all_read(conn: PGConnection, *, user_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_id = %s AND NOT is_read
            """,
            (user_id,),
        )
        return cur.rowcount
