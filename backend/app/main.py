"""
API HTTP con Flask.
Ejecutar desde la carpeta `backend`:  python main.py
(o: python -m app.main  con PYTHONPATH apuntando a backend)
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Mapping

from flask import Flask, Response, jsonify, request

# Permite ejecutar `python app/main.py` desde la carpeta backend.
if __package__ in (None, ""):
    _backend_root = Path(__file__).resolve().parent.parent
    if str(_backend_root) not in sys.path:
        sys.path.insert(0, str(_backend_root))

from app.email.config import max_payload_bytes
from app.request_parse import ParseBodyError, parse_body_for_dispatch
from app.router import dispatch
from app.utils.response import BinaryPayload, cors_headers


def _flat_query_args() -> dict[str, str]:
    return {k: (request.args.get(k) or "") for k in request.args}


def _headers_mapping() -> Mapping[str, str]:
    return {str(k): str(v) for k, v in request.headers.items()}


def create_app() -> Flask:
    app = Flask(__name__)
    app.json.ensure_ascii = False
    app.config["MAX_CONTENT_LENGTH"] = max_payload_bytes()

    @app.errorhandler(413)
    def _payload_too_large(_e: object) -> tuple[Response, int]:
        return jsonify({"error": "Cuerpo demasiado grande"}), 413

    @app.after_request
    def _add_cors(response: Response) -> Response:
        for k, v in cors_headers().items():
            if k not in response.headers:
                response.headers[k] = v
        return response

    def _json_response(status: int, payload: dict) -> Response:
        r = jsonify(payload)
        r.status_code = status
        return r

    def _binary_response(status: int, bp: BinaryPayload) -> Response:
        r = Response(bp.body, status=status, mimetype=bp.content_type)
        r.headers["Content-Length"] = str(len(bp.body))
        r.headers["Content-Disposition"] = f'attachment; filename="{bp.filename.replace(chr(34), "")}"'
        return r

    def _handle_dispatch(**_view_args: object) -> Response:
        if request.method == "OPTIONS":
            return Response(status=204)

        method = request.method
        path = request.path
        q = _flat_query_args()
        h = _headers_mapping()

        body_in: dict | None = None
        if method == "GET" or method == "DELETE":
            body_in = None
        elif method in ("POST", "PATCH"):
            raw = request.get_data(cache=True)
            try:
                body_in = parse_body_for_dispatch(method, raw, request.headers.get("Content-Type"))
            except ParseBodyError as e:
                return _json_response(e.status, e.payload)
        else:
            return _json_response(405, {"error": "Método no permitido"})

        status, body = dispatch(method, path, body_in, q, h)
        if isinstance(body, BinaryPayload):
            return _binary_response(status, body)
        return _json_response(status, body)

    app.add_url_rule(
        "/",
        endpoint="dispatch_root",
        view_func=_handle_dispatch,
        methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    )
    app.add_url_rule(
        "/<path:subpath>",
        endpoint="dispatch_subpath",
        view_func=_handle_dispatch,
        methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    )

    return app


def run_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    app = create_app()
    print(f"Servidor Flask en http://{host}:{port}")
    print("  POST /api/auth/login/     — login")
    print("  POST /api/auth/refresh/   — renovar access")
    print("  GET  /api/tickets/        — listado tickets")
    print("  POST /api/tickets/        — crear ticket")
    print("  GET  /api/tickets/{{id}}  — detalle")
    print("  PATCH /api/tickets/{{id}} — actualizar")
    print("  GET  /api/agents/         — agentes (admin)")
    print("  GET  /api/attachments/{{id}} — descargar adjunto")
    print("  GET  /health              — comprobación")
    try:
        app.run(host=host, port=port, threaded=True, use_reloader=False)
    except KeyboardInterrupt:
        print("\nDeteniendo servidor…")


if __name__ == "__main__":
    run_server()
