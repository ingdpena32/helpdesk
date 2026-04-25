"""Persistencia de sesiones (tokens de acceso y refresco)."""

from __future__ import annotations

from datetime import datetime

from psycopg2.extensions import connection as PGConnection


def insert_session(
    conn: PGConnection,
    *,
    user_id: int,
    access_token: str,
    refresh_token: str,
    access_expires_at: datetime,
    refresh_expires_at: datetime,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sessions (user_id, access_token, refresh_token, access_expires_at, refresh_expires_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, access_token, refresh_token, access_expires_at, refresh_expires_at),
        )


def find_user_by_access_token(conn: PGConnection, access_token: str) -> tuple[int, str, str] | None:
    """Devuelve (user_id, email, role) si el token de acceso es válido y no expiró."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.email, u.role
            FROM sessions s
            INNER JOIN users u ON u.id = s.user_id
            WHERE s.access_token = %s
              AND s.access_expires_at > NOW()
            LIMIT 1
            """,
            (access_token,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    uid, em, role = row
    return (int(uid), str(em), str(role))


def find_session_by_refresh_token(
    conn: PGConnection, refresh_token: str
) -> tuple[int, int] | None:
    """
    Devuelve (session_id, user_id) si el refresh es válido y no expiró.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.user_id
            FROM sessions s
            WHERE s.refresh_token = %s
              AND s.refresh_expires_at > NOW()
            LIMIT 1
            """,
            (refresh_token,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    sid, uid = row
    return (int(sid), int(uid))


def update_access_for_session(
    conn: PGConnection,
    *,
    session_id: int,
    access_token: str,
    access_expires_at: datetime,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE sessions
            SET access_token = %s, access_expires_at = %s
            WHERE id = %s
            """,
            (access_token, access_expires_at, session_id),
        )
