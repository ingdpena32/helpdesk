"""
Servidor HTTP con biblioteca estándar.
Ejecutar desde la carpeta `backend`:  python main.py
(o: python -m app.main  con PYTHONPATH apuntando a backend)
"""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Mapping
from urllib.parse import parse_qs, urlparse

# Permite ejecutar `python app/main.py` desde la carpeta backend.
if __package__ in (None, ""):
    _backend_root = Path(__file__).resolve().parent.parent
    if str(_backend_root) not in sys.path:
        sys.path.insert(0, str(_backend_root))

from app.router import dispatch
from app.utils.response import json_body, merge_headers


def _flat_query(query_string: str) -> dict[str, str]:
    if not query_string:
        return {}
    out: dict[str, str] = {}
    for key, values in parse_qs(query_string).items():
        if values:
            out[key] = values[0]
    return out


def _headers_dict(handler: BaseHTTPRequestHandler) -> Mapping[str, str]:
    return {str(k): str(v) for k, v in handler.headers.items()}


class _RestHandler(BaseHTTPRequestHandler):
    server_version = "HelpdeskAPI/0.1"

    def log_message(self, format: str, *args) -> None:
        print(f"[{self.address_string()}] {format % args}")

    def _write_response(self, status: int, payload: dict) -> None:
        body = json_body(payload)
        self.send_response(status)
        for k, v in merge_headers({"Content-Length": str(len(body))}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body_required(self) -> dict | None:
        """Lee JSON cuando Content-Length > 0. Devuelve None si ya respondió 400."""
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b""
        if not raw:
            return {}
        try:
            loaded = json.loads(raw.decode("utf-8"))
            if loaded is not None and not isinstance(loaded, dict):
                self._write_response(400, {"error": "El cuerpo debe ser un objeto JSON"})
                return None
            return loaded
        except json.JSONDecodeError:
            self._write_response(400, {"error": "JSON inválido o mal formado"})
            return None

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        for k, v in merge_headers().items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        q = _flat_query(parsed.query)
        status, body = dispatch("GET", parsed.path, None, q, _headers_dict(self))
        self._write_response(status, body)

    def do_POST(self) -> None:
        parsed_url = urlparse(self.path)
        q = _flat_query(parsed_url.query)
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length == 0:
            body_json: dict | None = None
        else:
            body_json = self._read_json_body_required()
            if body_json is None:
                return

        status, body = dispatch("POST", parsed_url.path, body_json, q, _headers_dict(self))
        self._write_response(status, body)

    def do_PATCH(self) -> None:
        parsed_url = urlparse(self.path)
        q = _flat_query(parsed_url.query)
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length == 0:
            body_json = {}
        else:
            body_json = self._read_json_body_required()
            if body_json is None:
                return

        status, body = dispatch("PATCH", parsed_url.path, body_json, q, _headers_dict(self))
        self._write_response(status, body)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        q = _flat_query(parsed.query)
        status, body = dispatch("DELETE", parsed.path, None, q, _headers_dict(self))
        self._write_response(status, body)


def run_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = HTTPServer((host, port), _RestHandler)
    print(f"Servidor escuchando en http://{host}:{port}")
    print("  POST /api/auth/login/     — login")
    print("  POST /api/auth/refresh/   — renovar access")
    print("  GET  /api/tickets/        — listado tickets")
    print("  POST /api/tickets/        — crear ticket")
    print("  GET  /api/tickets/{{id}}  — detalle")
    print("  PATCH /api/tickets/{{id}} — actualizar")
    print("  GET  /api/agents/         — agentes (admin)")
    print("  GET  /health              — comprobación")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDeteniendo servidor…")
        server.shutdown()


if __name__ == "__main__":
    run_server()
