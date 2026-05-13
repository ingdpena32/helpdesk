"""HTTP: adjuntos."""

from __future__ import annotations

from typing import Any, Mapping

from app.services import attachment_service


def get_attachment_download(
    _body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str], attachment_id: int
) -> tuple[int, dict[str, Any] | Any]:
    return attachment_service.download_attachment(headers, attachment_id)


def get_ticket_attachments_list(
    _body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str], ticket_id: int
) -> tuple[int, dict[str, Any]]:
    return attachment_service.list_for_ticket_json(headers, ticket_id)
