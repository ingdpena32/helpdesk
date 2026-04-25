"""
Enrutamiento: asocia (método, ruta) con controladores.
Sin lógica de negocio ni SQL.
"""

from __future__ import annotations

from typing import Any, Callable, Mapping
from urllib.parse import urlparse

from app.controllers import agent_controller, auth_controller, ticket_controller
from app.utils.http_path import canonical_api_path, normalize_path as norm_path

Handler = Callable[[dict[str, Any] | None, dict[str, str], Mapping[str, str]], tuple[int, dict]]


def get_health(
    _body: dict[str, Any] | None, _query: dict[str, str], _headers: Mapping[str, str]
) -> tuple[int, dict]:
    return 200, {"status": "ok", "service": "helpdesk-api"}


_ROUTES: dict[tuple[str, str], Handler] = {
    ("GET", "/"): get_health,
    ("GET", "/health"): get_health,
    ("POST", "/auth/login"): auth_controller.post_login,
    ("POST", "/api/auth/login"): auth_controller.post_login,
    ("POST", "/auth/refresh"): auth_controller.post_refresh,
    ("POST", "/api/auth/refresh"): auth_controller.post_refresh,
    ("GET", "/api/agents"): agent_controller.get_list,
    ("POST", "/api/agents"): agent_controller.post_create,
}


def _is_tickets_collection(path: str) -> bool:
    """True si es la colección de tickets (tras canonical_api_path → siempre /api/tickets)."""
    raw = (path or "").strip().replace("\x00", "").replace("\r", "").lstrip("\ufeff")
    if raw.lower().startswith(("http://", "https://")):
        raw = urlparse(raw.replace("\\", "/")).path or "/"
    else:
        raw = raw.split("?", 1)[0]
    raw = raw.replace("\\", "/")
    while "//" in raw:
        raw = raw.replace("//", "/")
    if not raw.startswith("/"):
        raw = "/" + raw
    raw = canonical_api_path(raw)
    return raw == "/api/tickets"


def normalize_path(path: str) -> str:
    """Delegación al util común (mantiene nombre exportado para compatibilidad)."""
    return norm_path(path)


def dispatch(
    method: str,
    path: str,
    json_body: dict[str, Any] | None,
    query: dict[str, str] | None = None,
    headers: Mapping[str, str] | None = None,
) -> tuple[int, dict]:
    m = method.upper()
    q = query if query is not None else {}
    h: Mapping[str, str] = headers if headers is not None else {}

    path = canonical_api_path(path)

    if _is_tickets_collection(path):
        if m == "POST":
            return ticket_controller.post_create(json_body, q, h)
        if m == "GET":
            return ticket_controller.get_list(json_body, q, h)
        return 405, {"error": "Método no permitido"}

    sub = ticket_controller.match_ticket_subresource(m, path)
    if sub is not None:
        action, tid = sub
        if action == "ticket_get":
            return ticket_controller.get_one(json_body, q, h, tid)
        if action == "ticket_patch":
            return ticket_controller.patch_one(json_body, q, h, tid)
        if action == "ticket_delete":
            return ticket_controller.delete_one(json_body, q, h, tid)
        if action == "comments_get":
            return ticket_controller.get_comments(json_body, q, h, tid)
        if action == "comments_post":
            return ticket_controller.post_comment(json_body, q, h, tid)
        return 405, {"error": "Método no permitido"}

    key = (m, normalize_path(path))
    handler = _ROUTES.get(key)
    if handler is None:
        return 404, {"error": "Ruta no encontrada"}
    return handler(json_body, q, h)
