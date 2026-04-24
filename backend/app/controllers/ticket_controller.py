"""Controlador HTTP de tickets: adapta request JSON/query al servicio."""

from __future__ import annotations

from typing import Any

from app.services import ticket_service


def post_create(body: dict[str, Any] | None, _query: dict[str, str]) -> tuple[int, dict]:
    """POST /api/tickets/ — creación."""
    if body is None:
        body = {}
    return ticket_service.create_from_request(body)


def get_list(_body: dict[str, Any] | None, query: dict[str, str]) -> tuple[int, dict]:
    """GET /api/tickets/ — listado con filtros en query string."""
    return ticket_service.list_tickets(query)
