"""
Enrutamiento mínimo: asocia (método, ruta) con controladores.
Sin lógica de negocio ni SQL.
"""

from __future__ import annotations

from typing import Any, Callable

from app.controllers import auth_controller

Handler = Callable[[dict[str, Any] | None], tuple[int, dict]]


def get_health(_body: dict[str, Any] | None = None) -> tuple[int, dict]:
    return 200, {"status": "ok", "service": "helpdesk-api"}


_ROUTES: dict[tuple[str, str], Handler] = {
    ("GET", "/"): get_health,
    ("GET", "/health"): get_health,
    # Compatibles con el frontend React (Vite proxy → /api/...)
    ("POST", "/auth/login"): auth_controller.post_login,
    ("POST", "/api/auth/login"): auth_controller.post_login,
}


def normalize_path(path: str) -> str:
    """Quita query string y barra final para coincidencia estable."""
    raw = path.split("?", 1)[0]
    if len(raw) > 1 and raw.endswith("/"):
        raw = raw[:-1]
    return raw or "/"


def dispatch(method: str, path: str, json_body: dict[str, Any] | None) -> tuple[int, dict]:
    key = (method.upper(), normalize_path(path))
    handler = _ROUTES.get(key)
    if handler is None:
        return 404, {"error": "Ruta no encontrada"}
    return handler(json_body)
