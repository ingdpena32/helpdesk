"""Perfil autenticado y carga de foto."""

from __future__ import annotations

from typing import Any, Mapping

from flask import Request

from app.services import profile_service


def get_me(_body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return profile_service.get_my_profile(headers)


def patch_me(body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]) -> tuple[int, dict]:
    return profile_service.patch_my_profile(headers, body)


def get_profile_file(
    _body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str], filename: str
) -> tuple[int, dict | Any]:
    return profile_service.serve_profile_photo(headers, filename)


def post_photo_from_request(headers: Mapping[str, str], req: Request) -> tuple[int, dict]:
    f = req.files.get("file") or req.files.get("photo")
    return profile_service.upload_profile_photo(headers, f)
