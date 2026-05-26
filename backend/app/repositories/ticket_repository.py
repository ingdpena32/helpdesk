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
    transferred_by, transferred_at, ai_status, ai_motivo
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
        ai_status,
        ai_motivo,
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
        ai_status=str(ai_status) if ai_status is not None else "Sin IA",
        ai_motivo=str(ai_motivo) if ai_motivo is not None else None,
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


def _ticket_list_conditions(
    *,
    status: str | None = None,
    priority: str | None = None,
    assigned_to: int | None = None,
    category: str | None = None,
    search: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    table_alias: str = "",
) -> tuple[list[str], list[Any]]:
    col = f"{table_alias}." if table_alias else ""
    conditions: list[str] = [f"{col}deleted_at IS NULL"]
    params: list[Any] = []
    if status:
        conditions.append(f"{col}status = %s")
        params.append(status)
    if priority:
        conditions.append(f"{col}priority = %s")
        params.append(priority)
    if assigned_to is not None:
        conditions.append(f"{col}assigned_to = %s")
        params.append(assigned_to)
    if category:
        conditions.append(f"{col}category = %s")
        params.append(category)
    if created_from is not None:
        conditions.append(f"{col}created_at >= %s")
        params.append(created_from)
    if created_to is not None:
        conditions.append(f"{col}created_at <= %s")
        params.append(created_to)
    term = (search or "").strip()
    if term:
        like = f"%{term}%"
        id_part = ""
        search_params: list[Any] = [like, like, like, like, like, like]
        if term.isdigit():
            id_part = f" OR {col}id = %s"
            search_params.append(int(term))
        conditions.append(
            f"({col}title ILIKE %s OR {col}description ILIKE %s OR {col}category ILIKE %s "
            f"OR COALESCE({col}sender_email, '') ILIKE %s OR COALESCE({col}sender_name, '') ILIKE %s "
            f"OR COALESCE({col}ai_motivo, '') ILIKE %s"
            f"{id_part})"
        )
        params.extend(search_params)
    return conditions, params


def count_filtered(
    conn: PGConnection,
    *,
    status: str | None = None,
    priority: str | None = None,
    assigned_to: int | None = None,
    category: str | None = None,
    search: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> int:
    conditions, params = _ticket_list_conditions(
        status=status,
        priority=priority,
        assigned_to=assigned_to,
        category=category,
        search=search,
        created_from=created_from,
        created_to=created_to,
    )
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
    search: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Ticket]:
    conditions, params = _ticket_list_conditions(
        status=status,
        priority=priority,
        assigned_to=assigned_to,
        category=category,
        search=search,
        created_from=created_from,
        created_to=created_to,
    )
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


def update_ai_classification(
    conn: PGConnection,
    ticket_id: int,
    *,
    category: str,
    priority: str,
    ai_motivo: str | None,
    ai_status: str,
) -> Ticket | None:
    """Actualiza categoría/prioridad/motivo tras clasificación IA (tickets desde correo)."""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE tickets
            SET
                category = %s,
                priority = %s,
                ai_motivo = %s,
                ai_status = %s,
                updated_at = NOW()
            WHERE id = %s AND deleted_at IS NULL
            RETURNING
                {_SELECT_TICKET_ROW.strip()}
            """,
            (category, priority, ai_motivo, ai_status, ticket_id),
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
    priority: str | None = None,
    category: str | None = None,
    ai_status: str | None = None,
) -> Ticket | None:
    """Actualiza ciclo de vida y campos de gestión; no afecta filas eliminadas lógicamente."""
    sets = [
        "status = %s",
        "assigned_to = %s",
        "resolution = %s",
        "closed_at = %s",
    ]
    params: list[Any] = [status, assigned_to, resolution, closed_at]
    if priority is not None:
        sets.append("priority = %s")
        params.append(priority)
    if category is not None:
        sets.append("category = %s")
        params.append(category)
    if ai_status is not None:
        sets.append("ai_status = %s")
        params.append(ai_status)
    sets.append("updated_at = NOW()")
    params.append(ticket_id)
    sql = f"""
            UPDATE tickets
            SET {", ".join(sets)}
            WHERE id = %s AND deleted_at IS NULL
            RETURNING
                {_SELECT_TICKET_ROW.strip()}
            """
    with conn.cursor() as cur:
        cur.execute(sql, tuple(params))
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
                sender_name, sender_email, raw_from, sender_user_id, ai_status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                "Procesando IA",
            ),
        )
        row = cur.fetchone()
    if row is None:
        raise RuntimeError("INSERT inbound no devolvió fila")
    return _row_to_ticket(row)


def dashboard_stats(
    conn: PGConnection,
    *,
    priority: str | None = None,
    assigned_to: int | None = None,
    category: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> dict[str, float | int]:
    """Conteos por estado, prioridad alta y tiempo medio de cierre (SQL)."""
    conditions, params = _ticket_list_conditions(
        priority=priority,
        assigned_to=assigned_to,
        category=category,
        created_from=created_from,
        created_to=created_to,
    )
    where = " WHERE " + " AND ".join(conditions)
    sql = f"""
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
            COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
            COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_count,
            COUNT(*) FILTER (WHERE priority = 'high')::int AS high_priority_count,
            AVG(
                EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600.0
            ) FILTER (
                WHERE status = 'closed'
                  AND closed_at IS NOT NULL
                  AND closed_at > created_at
            ) AS avg_resolution_hours
        FROM tickets
        {where}
    """
    with conn.cursor() as cur:
        cur.execute(sql, tuple(params))
        row = cur.fetchone()
    if row is None:
        return {
            "total": 0,
            "open": 0,
            "in_progress": 0,
            "closed": 0,
            "high_priority": 0,
            "avg_resolution_hours": None,
        }
    total, open_c, in_prog, closed_c, high_p, avg_h = row
    return {
        "total": int(total),
        "open": int(open_c),
        "in_progress": int(in_prog),
        "closed": int(closed_c),
        "high_priority": int(high_p),
        "avg_resolution_hours": float(avg_h) if avg_h is not None else None,
    }


def tickets_by_agent_and_status(
    conn: PGConnection,
    *,
    priority: str | None = None,
    assigned_to: int | None = None,
    category: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> list[tuple[int | None, str, str, int]]:
    """Filas (agent_id, agent_label, status, count) para gráfico apilado."""
    conditions, params = _ticket_list_conditions(
        priority=priority,
        assigned_to=assigned_to,
        category=category,
        created_from=created_from,
        created_to=created_to,
        table_alias="t",
    )
    where = " WHERE " + " AND ".join(conditions)
    sql = f"""
        SELECT
            t.assigned_to,
            COALESCE(
                NULLIF(TRIM(u.full_name), ''),
                NULLIF(TRIM(u.email), ''),
                'Sin asignar'
            ) AS agent_label,
            t.status,
            COUNT(*)::int AS cnt
        FROM tickets t
        LEFT JOIN users u ON u.id = t.assigned_to
        {where}
        GROUP BY t.assigned_to, t.status, u.full_name, u.email
        ORDER BY agent_label, t.status
    """
    with conn.cursor() as cur:
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
    return [(r[0], str(r[1]), str(r[2]), int(r[3])) for r in rows]
