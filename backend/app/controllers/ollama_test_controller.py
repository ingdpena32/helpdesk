"""Rutas de prueba / diagnóstico para integración Ollama (uso temporal en desarrollo)."""

from __future__ import annotations

from typing import Any, Mapping

from app.auth import permissions
from app.database.db import get_connection
from app.services import ai_service, auth_service
from app.services.ai_catalog import load_catalog_from_db


def post_test_ollama(
    body: dict[str, Any] | None, _query: dict[str, str], headers: Mapping[str, str]
) -> tuple[int, dict]:
    """
    POST /api/test-ollama
    Cuerpo: {"subject": "...", "body": "..."}
    Requiere sesión de usuario administrador o agente.
    """
    if body is None:
        body = {}
    subject = body.get("subject")
    text_body = body.get("body")
    if not isinstance(subject, str):
        return 400, {"error": "subject debe ser texto"}
    if not isinstance(text_body, str):
        return 400, {"error": "body debe ser texto"}

    catalog = None
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.is_operative_staff(user.role):
                return 403, {"error": "Solo personal operativo puede usar esta ruta de prueba"}
            catalog = load_catalog_from_db(conn)
    except Exception:
        return 500, {"error": "No se pudo verificar la sesión o cargar catálogo de BD."}

    result = ai_service.clasificar_ticket(subject, text_body, catalog=catalog)
    return 200, {
        "departamento": result["departamento"],
        "prioridad": result["prioridad_label"],
        "prioridad_db": result["prioridad_db"],
        "motivo": result["motivo"],
        "used_fallback": result["used_fallback"],
        "ollama_url": ai_service.ollama_base_url(),
        "ollama_model": ai_service.ollama_model(),
        "ollama_request_seconds": result.get("ollama_request_seconds"),
        "ollama_server_duration_seconds": result.get("ollama_server_duration_seconds"),
        "ollama_total_seconds": result.get("ollama_total_seconds"),
        "approx_prompt_tokens": result.get("approx_prompt_tokens"),
        "cleaned_json": result.get("final_classification_json"),
        "raw_model_json": result.get("raw_model_json"),
    }
