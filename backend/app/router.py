"""
Enrutamiento mínimo: asocia (método, ruta) con controladores.
Sin lógica de negocio ni SQL.
"""

from __future__ import annotations

from typing import Any, Callable
from urllib.parse import unquote, urlparse

from app.controllers import auth_controller, ticket_controller

Handler = Callable[[dict[str, Any] | None, dict[str, str]], tuple[int, dict]]


def get_health(_body: dict[str, Any] | None, _query: dict[str, str]) -> tuple[int, dict]:
    return 200, {"status": "ok", "service": "helpdesk-api"}


_ROUTES: dict[tuple[str, str], Handler] = {
    ("GET", "/"): get_health,
    ("GET", "/health"): get_health,
    # Compatibles con el frontend React (Vite proxy → /api/...)
    ("POST", "/auth/login"): auth_controller.post_login,
    ("POST", "/api/auth/login"): auth_controller.post_login,
    # Tickets: resueltos en dispatch() antes del mapa (más robusto ante barras finales / proxies)
    ("POST", "/tickets"): ticket_controller.post_create,
    ("GET", "/tickets"): ticket_controller.get_list,
}


def _is_tickets_collection(path: str) -> bool:
    """
    True si el path apunta a la colección /api/tickets (crear o listar).
    No depende solo de normalize_path: evita 404 cuando el path llega con matices raros.
    """
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
    raw = raw.rstrip("/")
    return raw in ("/api/tickets", "/tickets")


def normalize_path(path: str) -> str:
    """
    Unifica el path de la petición (proxies o clientes pueden variar el formato).
    - Acepta URI absoluta (p. ej. proxy que reenvía la URL completa).
    - Decodifica %2F, etc.
    - Barra inicial, sin dobles barras, sin barra final salvo raíz.
    """
    p = (path or "").strip()
    if p.lower().startswith(("http://", "https://")):
        p = urlparse(p).path or "/"
    else:
        p = p.split("?", 1)[0]
    p = unquote(p)
    p = p.replace("\\", "/")
    if not p.startswith("/"):
        p = "/" + p
    while "//" in p:
        p = p.replace("//", "/")
    if len(p) > 1 and p.endswith("/"):
        p = p[:-1]
    return p or "/"


def dispatch(
    method: str,
    path: str,
    json_body: dict[str, Any] | None,
    query: dict[str, str] | None = None,
) -> tuple[int, dict]:
    m = method.upper()
    q = query if query is not None else {}

    # Colección tickets: comprobar primero (POST/GET /api/tickets/ o variantes)
    if _is_tickets_collection(path):
        if m == "POST":
            return ticket_controller.post_create(json_body, q)
        if m == "GET":
            return ticket_controller.get_list(json_body, q)
        return 405, {"error": "Método no permitido"}

    key = (m, normalize_path(path))
    handler = _ROUTES.get(key)
    if handler is None:
        return 404, {"error": "Ruta no encontrada"}
    return handler(json_body, q)
