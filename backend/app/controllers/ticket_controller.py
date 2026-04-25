"""Controlador HTTP de tickets: adapta request JSON/query/cabeceras al servicio."""

from __future__ import annotations

import re
from typing import Any, Mapping

from app.services import ticket_service
from app.utils.http_path import canonical_api_path, normalize_path


def post_create(body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    if body is None:
        body = {}
    return ticket_service.create_from_request(headers, body)


def get_list(_body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return ticket_service.list_tickets(headers, query)


def get_one(_body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str], ticket_id: int) -> tuple[
    int, dict
]:
    return ticket_service.get_ticket(headers, ticket_id)


def patch_one(body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str], ticket_id: int) -> tuple[
    int, dict
]:
    return ticket_service.patch_ticket(headers, ticket_id, body)


def delete_one(
    _body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str], ticket_id: int
) -> tuple[int, dict]:
    return ticket_service.soft_delete_ticket(headers, ticket_id)


def get_comments(
    _body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str], ticket_id: int
) -> tuple[int, dict]:
    return ticket_service.list_comments(headers, ticket_id)


def post_comment(
    body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str], ticket_id: int
) -> tuple[int, dict]:
    return ticket_service.add_comment(headers, ticket_id, body)


# Tras canonical_api_path no hay barra final; aceptamos también patrón con / opcional por si se llama sin canonicalizar.
_TICKET_ID_RE = re.compile(r"^/api/tickets/(\d+)/comments/?$")
_TICKET_ONE_RE = re.compile(r"^/api/tickets/(\d+)/?$")


def match_ticket_subresource(
    method: str, path: str
) -> tuple[str, int] | None:
    """
    Si el path corresponde a un subrecurso de ticket, devuelve (acción, ticket_id).
    """
    p = canonical_api_path(path)
    p = normalize_path(p)
    m = _TICKET_ID_RE.match(p)
    if m:
        tid = int(m.group(1))
        if method == "GET":
            return ("comments_get", tid)
        if method == "POST":
            return ("comments_post", tid)
        return None
    m2 = _TICKET_ONE_RE.match(p)
    if m2:
        tid = int(m2.group(1))
        if method == "GET":
            return ("ticket_get", tid)
        if method == "PATCH":
            return ("ticket_patch", tid)
        if method == "DELETE":
            return ("ticket_delete", tid)
        return None
    return None
