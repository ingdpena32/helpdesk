"""Acceso a datos de usuarios. Solo SQL y mapeo a modelos."""

from __future__ import annotations

from typing import Any

from psycopg2.extensions import connection as PGConnection

from app.models.user import User


def insert_user(
    conn: PGConnection,
    *,
    email: str,
    password_hash: str,
    role: str,
) -> User:
    """Inserta usuario (email ya normalizado por el servicio)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (email, password_hash, role)
            VALUES (%s, %s, %s)
            RETURNING id, email, password_hash, role
            """,
            (email, password_hash, role),
        )
        row = cur.fetchone()
    if row is None:
        raise RuntimeError("INSERT users no devolvió fila")
    return _row_to_user(row)


def _row_to_user(row: tuple[Any, ...]) -> User:
    uid, em, ph, role = row
    return User(
        id=int(uid),
        email=str(em),
        password_hash=str(ph) if ph is not None else "",
        role=str(role),
    )


def find_by_email(conn: PGConnection, email: str) -> User | None:
    normalized = email.strip().lower()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, password_hash, role
            FROM users
            WHERE LOWER(TRIM(email)) = %s
            LIMIT 1
            """,
            (normalized,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_user(row)


def find_by_id(conn: PGConnection, user_id: int) -> User | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, password_hash, role
            FROM users
            WHERE id = %s
            LIMIT 1
            """,
            (user_id,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_user(row)


def list_agents_with_workload(conn: PGConnection) -> list[tuple[User, int]]:
    """
    Usuarios con rol 'agent' y número de tickets asignados (abiertos + en progreso).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.email, u.password_hash, u.role,
                   COALESCE(
                       (
                           SELECT COUNT(*)::int
                           FROM tickets t
                           WHERE t.assigned_to = u.id
                             AND t.status IN ('open', 'in_progress')
                             AND t.deleted_at IS NULL
                       ),
                       0
                   ) AS workload
            FROM users u
            WHERE LOWER(TRIM(u.role)) = 'agent'
            ORDER BY u.email
            """
        )
        rows = cur.fetchall()
    out: list[tuple[User, int]] = []
    for row in rows:
        uid, em, ph, role, workload = row
        u = User(id=int(uid), email=str(em), password_hash=str(ph) if ph is not None else "", role=str(role))
        out.append((u, int(workload)))
    return out
