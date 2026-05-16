"""
Enrutamiento: asocia (método, ruta) con controladores.
Sin lógica de negocio ni SQL.
"""

from __future__ import annotations

import re
from typing import Any, Callable, Mapping

from app.controllers import (
    admin_controller,
    agent_controller,
    attachment_controller,
    auth_controller,
    notification_controller,
    ollama_test_controller,
    profile_controller,
    ticket_controller,
)
from app.utils.http_path import canonical_api_path, normalize_path as norm_path
from app.utils.response import BinaryPayload

Handler = Callable[[dict[str, Any] | None, dict[str, str], Mapping[str, str]], tuple[int, dict]]

_ATTACH_RE = re.compile(r"^/api/attachments/(\d+)$")
_TICK_ATTACH_RE = re.compile(r"^/api/tickets/(\d+)/attachments$")


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


def normalize_path(path: str) -> str:
    """Delegación al util común (mantiene nombre exportado para compatibilidad)."""
    return norm_path(path)


def dispatch(
    method: str,
    path: str,
    json_body: dict[str, Any] | None,
    query: dict[str, str] | None = None,
    headers: Mapping[str, str] | None = None,
) -> tuple[int, dict[str, Any] | BinaryPayload]:
    m = method.upper()
    q = query if query is not None else {}
    h: Mapping[str, str] = headers if headers is not None else {}

    path = canonical_api_path(path)

    np = normalize_path(path)

    if m == "GET" and np == "/api/me/profile":
        return profile_controller.get_me(json_body, q, h)

    if m == "PATCH" and np == "/api/me/profile":
        return profile_controller.patch_me(json_body, q, h)

    if m == "GET" and np == "/api/departments":
        return agent_controller.get_departments(json_body, q, h)

    if m == "POST" and np == "/api/test-ollama":
        return ollama_test_controller.post_test_ollama(json_body, q, h)

    if m == "GET" and np == "/api/admin/tickets-export":
        return admin_controller.get_tickets_export(json_body, q, h)

    _prof_fn = re.match(r"^/api/uploads/profiles/([^/]+)$", np)
    if m == "GET" and _prof_fn:
        return profile_controller.get_profile_file(json_body, q, h, _prof_fn.group(1))

    _agents_id = re.match(r"^/api/agents/(\d+)$", np)
    if _agents_id:
        aid = int(_agents_id.group(1))
        if m == "PUT":
            return agent_controller.put_update(json_body, q, h, aid)
        if m == "DELETE":
            return agent_controller.delete_one(json_body, q, h, aid)

    if m == "GET" and np == "/api/notifications/unread-count":
        return notification_controller.get_unread_count(json_body, q, h)

    if m == "GET" and np == "/api/notifications":
        return notification_controller.get_list(json_body, q, h)

    if m == "PATCH":
        if np == "/api/notifications/read-all":
            return notification_controller.patch_read_all(json_body, q, h)
        _notif_read = re.match(r"^/api/notifications/(\d+)/read$", np)
        if _notif_read:
            return notification_controller.patch_read_one(
                json_body, q, h, int(_notif_read.group(1))
            )

    if m == "GET":
        ma = _ATTACH_RE.match(path)
        if ma:
            return attachment_controller.get_attachment_download(json_body, q, h, int(ma.group(1)))
        mt = _TICK_ATTACH_RE.match(path)
        if mt:
            return attachment_controller.get_ticket_attachments_list(json_body, q, h, int(mt.group(1)))

    if path == "/api/tickets":
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
        if action == "ticket_transfer":
            return ticket_controller.put_transfer(json_body, q, h, tid)
        return 405, {"error": "Método no permitido"}

    key = (m, normalize_path(path))
    handler = _ROUTES.get(key)
    if handler is None:
        return 404, {"error": "Ruta no encontrada"}
    return handler(json_body, q, h)
