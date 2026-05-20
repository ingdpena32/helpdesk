"""Categorías de ticket."""

from __future__ import annotations

from typing import Any, Mapping

from app.services import category_service


def get_list(_body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return category_service.list_categories(headers)


def post_create(body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return category_service.create_category(headers, body)


def put_update(
    body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str], category_id: int
) -> tuple[int, dict]:
    return category_service.update_category(headers, category_id, body)


def delete_one(
    _body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str], category_id: int
) -> tuple[int, dict]:
    return category_service.delete_category(headers, category_id)
