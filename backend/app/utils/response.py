"""Utilidades para respuestas HTTP JSON (sin acoplar a http.server aquí)."""

from __future__ import annotations

import json
from typing import Any

JSON_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
}


def cors_headers() -> dict[str, str]:
    """Cabeceras CORS para desarrollo (React en otro puerto)."""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
    }


def merge_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {**JSON_HEADERS, **cors_headers()}
    if extra:
        h.update(extra)
    return h


def json_body(data: Any) -> bytes:
    return json.dumps(data, ensure_ascii=False).encode("utf-8")
