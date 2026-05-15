"""Agentes y departamentos."""

from __future__ import annotations

from typing import Any, Mapping

from app.services import agent_service


def get_list(_body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return agent_service.list_agents(headers)


def post_create(body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return agent_service.create_agent(headers, body)


def put_update(
    body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str], agent_id: int
) -> tuple[int, dict]:
    return agent_service.update_agent(headers, agent_id, body)


def delete_one(
    _body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str], agent_id: int
) -> tuple[int, dict]:
    return agent_service.delete_agent(headers, agent_id)


def get_departments(
    _body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]
) -> tuple[int, dict]:
    return agent_service.list_departments(headers)
