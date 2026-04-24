"""Acceso a datos de usuarios. Solo SQL y mapeo a modelos."""

from __future__ import annotations

from typing import Any

from psycopg2.extensions import connection as PGConnection

from app.models.user import User


def find_by_email(conn: PGConnection, email: str) -> User | None:
    """Busca un usuario por email (insensible a mayúsculas en el estándar típico usamos LOWER)."""
    normalized = email.strip().lower()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, password, role
            FROM users
            WHERE LOWER(TRIM(email)) = %s
            LIMIT 1
            """,
            (normalized,),
        )
        row: tuple[Any, ...] | None = cur.fetchone()
    if row is None:
        return None
    user_id, em, pwd, role = row
    return User(id=int(user_id), email=str(em), password=str(pwd), role=str(role))
