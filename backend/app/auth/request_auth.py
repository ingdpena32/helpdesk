"""Resolución de usuario autenticado a partir de cabeceras HTTP."""

from __future__ import annotations

from typing import Mapping

from psycopg2.extensions import connection as PGConnection

from app.models.user import User
from app.repositories import session_repository, user_repository


def _authorization_value(headers: Mapping[str, str]) -> str | None:
    for key, value in headers.items():
        if key.lower() == "authorization" and value:
            return value.strip()
    return None


def bearer_access_token(headers: Mapping[str, str]) -> str | None:
    raw = _authorization_value(headers)
    if raw is None:
        return None
    if raw.lower().startswith("bearer "):
        return raw[7:].strip() or None
    return None


def get_authenticated_user(conn: PGConnection, headers: Mapping[str, str]) -> User | None:
    token = bearer_access_token(headers)
    if not token:
        return None
    row = session_repository.find_user_by_access_token(conn, token)
    if row is None:
        return None
    uid, _email, _role = row
    return user_repository.find_by_id(conn, uid)
