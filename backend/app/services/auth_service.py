"""Lógica de negocio del login. No contiene SQL directo."""

from __future__ import annotations

import secrets

from app.database.db import get_connection
from app.repositories import user_repository


def _generate_simple_token(prefix: str) -> str:
    """Token opaco simulado (no JWT)."""
    return f"{prefix}_{secrets.token_urlsafe(24)}"


def _role_for_frontend(role: str) -> str:
    """El frontend TypeScript solo contempla admin | agent."""
    r = (role or "").strip().lower()
    if r == "admin":
        return "admin"
    return "agent"


def login(identifier: str, password: str | None) -> tuple[int, dict]:
    """
    Valida credenciales y devuelve (código HTTP, cuerpo JSON).
    Respuesta alineada con el cliente React: access, refresh, user (StoredUser).
    El identificador es el email (el campo user_name del front envía el mismo valor).
    Las contraseñas se comparan en texto plano solo con fines didácticos locales.
    """
    em = (identifier or "").strip()
    pw = password or ""

    if not em or not pw:
        return 400, {"error": "Usuario y contraseña son obligatorios"}

    try:
        with get_connection() as conn:
            user = user_repository.find_by_email(conn, em)
    except Exception:
        # No filtrar detalles internos al cliente
        return 500, {"error": "No se pudo validar el acceso. Intente más tarde."}

    if user is None or user.password != pw:
        return 401, {"error": "Credenciales inválidas"}

    access = _generate_simple_token("acc")
    refresh = _generate_simple_token("ref")
    role_out = _role_for_frontend(user.role)
    body = {
        "access": access,
        "refresh": refresh,
        "user": {
            "id": user.id,
            "user_name": user.email,
            "email": user.email,
            "role": role_out,
            "first_name": "",
            "last_name": "",
        },
    }
    return 200, body
