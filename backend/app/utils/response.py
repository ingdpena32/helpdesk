"""Utilidades de respuesta HTTP (CORS, adjuntos binarios)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BinaryPayload:
    """Respuesta GET no JSON (adjuntos)."""

    body: bytes
    content_type: str
    filename: str


def cors_headers() -> dict[str, str]:
    """Cabeceras CORS para desarrollo (React en otro puerto)."""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
    }
