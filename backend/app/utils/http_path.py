"""Normalización de paths HTTP."""

from __future__ import annotations

from urllib.parse import unquote, urlparse


def normalize_path(path: str) -> str:
    p = (path or "").strip()
    if p.lower().startswith(("http://", "https://")):
        p = urlparse(p).path or "/"
    else:
        p = p.split("?", 1)[0]
    p = unquote(p)
    p = p.replace("\\", "/")
    if not p.startswith("/"):
        p = "/" + p
    while "//" in p:
        p = p.replace("//", "/")
    if len(p) > 1 and p.endswith("/"):
        p = p[:-1]
    return p or "/"


def canonical_api_path(path: str) -> str:
    """
    Path único para enrutar: sin barra final (salvo '/'), sin /api duplicado
    y alias legacy /tickets → /api/tickets (por proxies o bases URL mal configuradas).
    """
    p = normalize_path(path)
    while True:
        if p.startswith("/api/api/"):
            p = "/api" + p[len("/api/api") :]
            continue
        if p == "/api/api":
            p = "/api"
            continue
        break
    if p == "/tickets" or p.startswith("/tickets/"):
        p = "/api" + p
    return normalize_path(p)
