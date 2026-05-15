"""HTTP: notificaciones (campana)."""

from __future__ import annotations

from typing import Any, Mapping

from app.services import notification_list_service


def get_list(_body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return notification_list_service.list_notifications(headers, query)


def get_unread_count(_body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return notification_list_service.unread_count(headers)


def patch_read_one(
    _body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str], notification_id: int
) -> tuple[int, dict]:
    return notification_list_service.mark_one_read(headers, notification_id)


def patch_read_all(_body: dict[str, Any] | None, query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return notification_list_service.mark_all_read(headers)
