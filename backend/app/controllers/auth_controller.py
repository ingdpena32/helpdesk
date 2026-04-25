"""Controlador HTTP de autenticación: adapta JSON de entrada a la capa de servicio."""

from __future__ import annotations

from typing import Any, Mapping

from app.services import auth_service


def post_refresh(body: dict[str, Any] | None, _query: dict[str, str], _headers: Mapping[str, str]) -> tuple[int, dict]:
    return auth_service.refresh_session(body)


def post_login(body: dict[str, Any] | None, _query: dict[str, str], _headers: Mapping[str, str]) -> tuple[int, dict]:
    """
    POST /auth/login o POST /api/auth/login/
    Frontend: {"user_name": "...", "password": "..."} (user_name suele ser el email).
    También se acepta {"email": "...", "password": "..."}.
    """
    if body is None:
        body = {}
    email = body.get("email")
    user_name = body.get("user_name")
    password = body.get("password")

    if email is not None and not isinstance(email, str):
        return 400, {"error": "El campo email debe ser texto"}
    if user_name is not None and not isinstance(user_name, str):
        return 400, {"error": "El campo user_name debe ser texto"}
    if password is not None and not isinstance(password, str):
        return 400, {"error": "El campo password debe ser texto"}

    identifier = (email or "").strip() or (user_name or "").strip()
    return auth_service.login(identifier, password)
