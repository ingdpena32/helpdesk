"""Comentarios de tickets."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from psycopg2.extensions import connection as PGConnection

from app.models.ticket_comment import TicketComment


def _row_to_comment(row: tuple[Any, ...]) -> TicketComment:
    cid, tid, uid, body, created_at = row
    return TicketComment(
        id=int(cid),
        ticket_id=int(tid),
        user_id=int(uid),
        body=str(body),
        created_at=created_at,
    )


def list_by_ticket(conn: PGConnection, ticket_id: int) -> list[TicketComment]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, ticket_id, user_id, body, created_at
            FROM ticket_comments
            WHERE ticket_id = %s
            ORDER BY created_at ASC, id ASC
            """,
            (ticket_id,),
        )
        rows = cur.fetchall()
    return [_row_to_comment(r) for r in rows]


def list_by_ticket_with_author_email(conn: PGConnection, ticket_id: int) -> list[tuple[TicketComment, str]]:
    """Cada fila: (TicketComment, email del autor)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id, c.ticket_id, c.user_id, c.body, c.created_at, u.email
            FROM ticket_comments c
            INNER JOIN users u ON u.id = c.user_id
            WHERE c.ticket_id = %s
            ORDER BY c.created_at ASC, c.id ASC
            """,
            (ticket_id,),
        )
        rows = cur.fetchall()
    out: list[tuple[TicketComment, str]] = []
    for row in rows:
        cid, tid, uid, body, created_at, email = row
        c = TicketComment(
            id=int(cid),
            ticket_id=int(tid),
            user_id=int(uid),
            body=str(body),
            created_at=created_at,
        )
        out.append((c, str(email)))
    return out


def insert(
    conn: PGConnection,
    *,
    ticket_id: int,
    user_id: int,
    body: str,
) -> TicketComment:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ticket_comments (ticket_id, user_id, body)
            VALUES (%s, %s, %s)
            RETURNING id, ticket_id, user_id, body, created_at
            """,
            (ticket_id, user_id, body),
        )
        row = cur.fetchone()
    if row is None:
        raise RuntimeError("INSERT ticket_comments no devolvió fila")
    return _row_to_comment(row)
