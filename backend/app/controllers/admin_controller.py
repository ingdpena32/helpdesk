"""Rutas administrativas globales (exportaciones, etc.)."""

from __future__ import annotations

from typing import Any, Mapping

from app.services import ticket_service


def get_tickets_export(
    _body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]
) -> tuple[int, dict]:
    return ticket_service.export_tickets_snapshot(headers)
