"""Listado de agentes (solo administradores)."""

from __future__ import annotations

from typing import Any, Mapping

from app.services import agent_service


def get_list(_body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return agent_service.list_agents(headers)


def post_create(body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return agent_service.create_agent(headers, body)
