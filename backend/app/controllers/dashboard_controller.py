"""Controlador HTTP del dashboard."""

from __future__ import annotations

from typing import Any, Mapping

from app.services import dashboard_service


def get_stats(
    _body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str]
) -> tuple[int, dict]:
    return dashboard_service.get_stats(headers, query)


def get_agent_breakdown(
    _body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str]
) -> tuple[int, dict]:
    return dashboard_service.get_agent_breakdown(headers, query)


def get_recent_activity(
    _body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str]
) -> tuple[int, dict]:
    return dashboard_service.get_recent_activity(headers, query)
