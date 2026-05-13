"""Metadatos de adjuntos en disco."""

from __future__ import annotations

from typing import Any

from psycopg2.extensions import connection as PGConnection

from app.models.ticket_attachment import TicketAttachment


def _row(row: tuple[Any, ...]) -> TicketAttachment:
    (
        aid,
        tid,
        cid,
        fn,
        mime,
        sz,
        path,
        ca,
        ua,
    ) = row
    return TicketAttachment(
        id=int(aid),
        ticket_id=int(tid),
        comment_id=int(cid) if cid is not None else None,
        original_filename=str(fn),
        mime_type=str(mime),
        size_bytes=int(sz),
        storage_path=str(path),
        created_at=ca,
        updated_at=ua,
    )


def insert(
    conn: PGConnection,
    *,
    ticket_id: int,
    comment_id: int | None,
    original_filename: str,
    mime_type: str,
    size_bytes: int,
    storage_path: str,
) -> TicketAttachment:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ticket_attachments (
                ticket_id, comment_id, original_filename, mime_type, size_bytes, storage_path
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING
                id, ticket_id, comment_id, original_filename, mime_type,
                size_bytes, storage_path, created_at, updated_at
            """,
            (ticket_id, comment_id, original_filename, mime_type, size_bytes, storage_path),
        )
        r = cur.fetchone()
    if r is None:
        raise RuntimeError("INSERT ticket_attachments sin fila")
    return _row(r)


def find_by_id(conn: PGConnection, attachment_id: int) -> TicketAttachment | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id, ticket_id, comment_id, original_filename, mime_type,
                size_bytes, storage_path, created_at, updated_at
            FROM ticket_attachments
            WHERE id = %s
            LIMIT 1
            """,
            (attachment_id,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row(row)


def list_by_ticket(conn: PGConnection, ticket_id: int) -> list[TicketAttachment]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id, ticket_id, comment_id, original_filename, mime_type,
                size_bytes, storage_path, created_at, updated_at
            FROM ticket_attachments
            WHERE ticket_id = %s
            ORDER BY id ASC
            """,
            (ticket_id,),
        )
        rows = cur.fetchall()
    return [_row(r) for r in rows]
