"""Lógica de negocio del login, refresh y sesiones."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

import bcrypt
from psycopg2.extensions import connection as PGConnection

from app.database.db import get_connection
from app.models.user import User
from app.repositories import session_repository, user_repository


ACCESS_TTL = timedelta(minutes=30)
REFRESH_TTL = timedelta(days=14)


def _generate_token() -> str:
    return secrets.token_urlsafe(48)


def _role_for_frontend(role: str) -> str:
    r = (role or "").strip().lower()
    if r == "admin":
        return "admin"
    return "agent"


def _user_json(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "user_name": user.email,
        "email": user.email,
        "role": _role_for_frontend(user.role),
        "first_name": "",
        "last_name": "",
    }


def _verify_password(plain: str, password_hash: str) -> bool:
    if not password_hash or not plain:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def login(identifier: str, password: str | None) -> tuple[int, dict]:
    em = (identifier or "").strip()
    pw = password or ""

    if not em or not pw:
        return 400, {"error": "Usuario y contraseña son obligatorios"}

    try:
        with get_connection() as conn:
            user = user_repository.find_by_email(conn, em)
            if user is None or not _verify_password(pw, user.password_hash):
                return 401, {"error": "Credenciales inválidas"}

            access = _generate_token()
            refresh = _generate_token()
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            session_repository.insert_session(
                conn,
                user_id=user.id,
                access_token=access,
                refresh_token=refresh,
                access_expires_at=now + ACCESS_TTL,
                refresh_expires_at=now + REFRESH_TTL,
            )
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo validar el acceso. Intente más tarde."}

    body = {
        "access": access,
        "refresh": refresh,
        "user": _user_json(user),
    }
    return 200, body


def refresh_session(body: dict[str, Any] | None) -> tuple[int, dict]:
    if body is None:
        body = {}
    raw = body.get("refresh")
    if not isinstance(raw, str) or not raw.strip():
        return 400, {"error": "El campo refresh es obligatorio"}

    refresh_token = raw.strip()

    try:
        with get_connection() as conn:
            found = session_repository.find_session_by_refresh_token(conn, refresh_token)
            if found is None:
                return 401, {"error": "Refresh token inválido o expirado"}

            session_id, _user_id = found
            new_access = _generate_token()
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            session_repository.update_access_for_session(
                conn,
                session_id=session_id,
                access_token=new_access,
                access_expires_at=now + ACCESS_TTL,
            )
            conn.commit()
    except Exception:
        return 500, {"error": "No se pudo renovar la sesión."}

    return 200, {"access": new_access}


def require_user(conn: PGConnection, headers: Mapping[str, str]) -> tuple[User | None, int | None, dict | None]:
    """
    Devuelve (user, None, None) si hay sesión válida.
    Si no, (None, status, error_body) para responder al cliente.
    """
    from app.auth.request_auth import get_authenticated_user

    user = get_authenticated_user(conn, headers)
    if user is None:
        return None, 401, {"error": "Autenticación requerida o token inválido"}
    return user, None, None
