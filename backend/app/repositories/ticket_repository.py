"""Acceso a datos de tickets. Solo SQL y mapeo a modelos."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from psycopg2.extensions import connection as PGConnection

from app.models.ticket import Ticket

_SELECT_TICKET_ROW = """
    id, title, description, created_by, priority, category, status,
    created_at, updated_at, assigned_to, resolution, closed_at, deleted_at,
    sender_name, sender_email, raw_from, sender_user_id,
    transferred_by, transferred_at
"""


def _active_clause(only_active: bool) -> str:
    return "deleted_at IS NULL" if only_active else "TRUE"


def _row_to_ticket(row: tuple[Any, ...]) -> Ticket:
    (
        tid,
        title,
        description,
        created_by,
        priority,
        category,
        status,
        created_at,
        updated_at,
        assigned_to,
        resolution,
        closed_at,
        deleted_at,
        sender_name,
        sender_email,
        raw_from,
        sender_user_id,
        transferred_by,
        transferred_at,
    ) = row
    return Ticket(
        id=int(tid),
        title=str(title),
        description=str(description),
        created_by=int(created_by),
        priority=str(priority),
        category=str(category),
        status=str(status),
        created_at=created_at,
        updated_at=updated_at,
        assigned_to=int(assigned_to) if assigned_to is not None else None,
        resolution=str(resolution) if resolution is not None else None,
        closed_at=closed_at,
        deleted_at=deleted_at,
        transferred_by=int(transferred_by) if transferred_by is not None else None,
        transferred_at=transferred_at,
        sender_name=str(sender_name) if sender_name is not None else None,
        sender_email=str(sender_email) if sender_email is not None else None,
        raw_from=str(raw_from) if raw_from is not None else None,
        sender_user_id=int(sender_user_id) if sender_user_id is not None else None,
    )


def insert(
    conn: PGConnection,
    *,
    title: str,
    description: str,
    created_by: int,
    priority: str,
    category: str,
) -> Ticket:
    """Inserta un ticket con valores por defecto de BD (status, fechas)."""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO tickets (title, description, created_by, priority, category)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING
                {_SELECT_TICKET_ROW.strip()}
            """,
            (title, description, created_by, priority, category),
        )
        row = cur.fetchone()
    if row is None:
        raise RuntimeError("INSERT no devolvió fila")
    return _row_to_ticket(row)


def count_filtered(
    conn: PGConnection,
    *,
    status: str | None = None,
    priority: str | None = None,
    assigned_to: int | None = None,
    category: str | None = None,
) -> int:
    conditions: list[str] = ["deleted_at IS NULL"]
    params: list[Any] = []
    if status:
        conditions.append("status = %s")
        params.append(status)
    if priority:
        conditions.append("priority = %s")
        params.append(priority)
    if assigned_to is not None:
        conditions.append("assigned_to = %s")
        params.append(assigned_to)
    if category:
        conditions.append("category = %s")
        params.append(category)
    where = " WHERE " + " AND ".join(conditions)
    with conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM tickets{where}", tuple(params))
        row = cur.fetchone()
    return int(row[0]) if row else 0


def list_filtered(
    conn: PGConnection,
    *,
    status: str | None = None,
    priority: str | None = None,
    assigned_to: int | None = None,
    category: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Ticket]:
    conditions: list[str] = ["deleted_at IS NULL"]
    params: list[Any] = []
    if status:
        conditions.append("status = %s")
        params.append(status)
    if priority:
        conditions.append("priority = %s")
        params.append(priority)
    if assigned_to is not None:
        conditions.append("assigned_to = %s")
        params.append(assigned_to)
    if category:
        conditions.append("category = %s")
        params.append(category)
    where = " WHERE " + " AND ".join(conditions)
    params.extend([limit, offset])
    sql = f"""
        SELECT
            {_SELECT_TICKET_ROW.strip()}
        FROM tickets
        {where}
        ORDER BY updated_at DESC
        LIMIT %s OFFSET %s
    """
    with conn.cursor() as cur:
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
    return [_row_to_ticket(r) for r in rows]


def list_all_non_deleted(conn: PGConnection) -> list[Ticket]:
    """Todos los tickets activos (no borrados lógicamente), p. ej. exportación admin."""
    sql = f"""
        SELECT {_SELECT_TICKET_ROW.strip()}
        FROM tickets
        WHERE deleted_at IS NULL
        ORDER BY id ASC
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    return [_row_to_ticket(r) for r in rows]


def find_by_id(conn: PGConnection, ticket_id: int, *, only_active: bool = True) -> Ticket | None:
    active_sql = _active_clause(only_active)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                {_SELECT_TICKET_ROW.strip()}
            FROM tickets
            WHERE id = %s AND ({active_sql})
            LIMIT 1
            """,
            (ticket_id,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_ticket(row)


def update_fields(
    conn: PGConnection,
    ticket_id: int,
    *,
    status: str,
    assigned_to: int | None,
    resolution: str | None,
    closed_at: datetime | None,
) -> Ticket | None:
    """Actualiza ciclo de vida; no afecta filas eliminadas lógicamente."""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE tickets
            SET
                status = %s,
                assigned_to = %s,
                resolution = %s,
                closed_at = %s,
                updated_at = NOW()
            WHERE id = %s AND deleted_at IS NULL
            RETURNING
                {_SELECT_TICKET_ROW.strip()}
            """,
            (status, assigned_to, resolution, closed_at, ticket_id),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_ticket(row)


def transfer_assignee(
    conn: PGConnection,
    ticket_id: int,
    *,
    new_assignee_id: int,
    transferred_by_user_id: int,
) -> Ticket | None:
    """Asigna ticket a otro agente/admin y registra metadatos de transferencia."""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE tickets
            SET
                assigned_to = %s,
                transferred_by = %s,
                transferred_at = NOW(),
                updated_at = NOW()
            WHERE id = %s AND deleted_at IS NULL
            RETURNING
                {_SELECT_TICKET_ROW.strip()}
            """,
            (new_assignee_id, transferred_by_user_id, ticket_id),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_ticket(row)


def soft_delete(conn: PGConnection, ticket_id: int) -> str:
    """
    Marca deleted_at = NOW() si el ticket existe y no estaba borrado.
    Devuelve: 'deleted' | 'not_found' | 'already_deleted'
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE tickets
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = %s AND deleted_at IS NULL
            RETURNING id
            """,
            (ticket_id,),
        )
        upd = cur.fetchone()
    if upd is not None:
        return "deleted"
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM tickets WHERE id = %s LIMIT 1", (ticket_id,))
        exists = cur.fetchone()
    if exists is None:
        return "not_found"
    return "already_deleted"


def find_ticket_id_by_message_reference(conn: PGConnection, message_id: str) -> int | None:
    """Resuelve ticket por Message-ID en el hilo (ticket raíz o comentario previo)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id FROM tickets
            WHERE email_message_id = %s AND deleted_at IS NULL
            LIMIT 1
            """,
            (message_id,),
        )
        row = cur.fetchone()
        if row is not None:
            return int(row[0])
        cur.execute(
            """
            SELECT ticket_id FROM ticket_comments
            WHERE message_id = %s
            LIMIT 1
            """,
            (message_id,),
        )
        row = cur.fetchone()
        if row is not None:
            return int(row[0])
    return None


def insert_from_inbound(
    conn: PGConnection,
    *,
    title: str,
    description: str,
    created_by: int,
    priority: str,
    category: str,
    email_message_id: str | None,
    sender_name: str | None,
    sender_email: str | None,
    raw_from: str | None,
    sender_user_id: int | None,
) -> Ticket:
    """Ticket creado desde correo (Message-ID raíz + metadatos del remitente)."""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO tickets (
                title, description, created_by, priority, category, email_message_id,
                sender_name, sender_email, raw_from, sender_user_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING
                {_SELECT_TICKET_ROW.strip()}
            """,
            (
                title,
                description,
                created_by,
                priority,
                category,
                email_message_id,
                sender_name,
                sender_email,
                raw_from,
                sender_user_id,
            ),
        )
        row = cur.fetchone()
    if row is None:
        raise RuntimeError("INSERT inbound no devolvió fila")
    return _row_to_ticket(row)
