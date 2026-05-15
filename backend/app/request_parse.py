"""Parseo de cuerpos HTTP (JSON) compartido por la capa Flask."""

from __future__ import annotations

import json
from typing import Any


class ParseBodyError(Exception):
    """Error de parseo: status HTTP y cuerpo JSON de error."""

    def __init__(self, status: int, payload: dict[str, Any]) -> None:
        super().__init__(payload.get("error", ""))
        self.status = status
        self.payload = payload


def _json_object_from_bytes(raw: bytes) -> dict[str, Any]:
    try:
        loaded = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise ParseBodyError(400, {"error": "JSON inválido o mal formado"}) from e
    if loaded is not None and not isinstance(loaded, dict):
        raise ParseBodyError(400, {"error": "El cuerpo debe ser un objeto JSON"})
    return loaded if isinstance(loaded, dict) else {}


def parse_patch_json(raw: bytes) -> dict[str, Any]:
    if not raw:
        return {}
    return _json_object_from_bytes(raw)


def parse_post_payload(raw: bytes, content_type_header: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    ct = (content_type_header or "").split(";")[0].strip().lower()
    if ct in ("application/json", "") or "json" in ct:
        return _json_object_from_bytes(raw)
    raise ParseBodyError(415, {"error": "Content-Type no soportado; use application/json"})


def parse_body_for_dispatch(method: str, raw: bytes, content_type_header: str | None) -> dict[str, Any]:
    """Cuerpo para POST/PATCH/PUT: vacío → {}."""
    assert method in ("POST", "PATCH", "PUT")
    if not raw:
        return {}
    if method == "PATCH":
        return parse_patch_json(raw)
    return parse_post_payload(raw, content_type_header)
