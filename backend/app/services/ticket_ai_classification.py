"""
Orquestación en segundo plano: clasificar ticket creado por correo y persistir resultado.
"""

from __future__ import annotations

import logging
import threading
from typing import Any

from app.database.db import get_connection
from app.repositories import ticket_repository
from app.services import ai_service
from app.services.ai_catalog import load_catalog_from_db
from app.services.category_service import validate_ticket_category
from app.services.ticket_service import ALLOWED_PRIORITIES

logger = logging.getLogger(__name__)


def _values_allowed_in_db(
    conn, *, category: str, priority: str
) -> tuple[bool, str | None, str | None]:
    """Comprueba categoría y prioridad contra catálogo/constraint de BD."""
    ok_cat, cat_canon = validate_ticket_category(conn, category)
    if not ok_cat or cat_canon is None:
        return False, None, None
    prio = (priority or "").strip().lower()
    if prio not in ALLOWED_PRIORITIES:
        return False, None, None
    return True, cat_canon, prio


def _run_classification(ticket_id: int, subject: str, body: str) -> None:
    logger.info("IA: inicio clasificación ticket_id=%s", ticket_id)
    try:
        with get_connection() as conn:
            catalog = load_catalog_from_db(conn)
    except Exception:
        logger.exception("IA: no se pudo cargar catálogo BD ticket_id=%s", ticket_id)
        return

    try:
        result: dict[str, Any] = ai_service.clasificar_ticket(subject, body, catalog=catalog)
    except Exception:
        logger.exception("IA: fallo no capturado en clasificar_ticket ticket_id=%s", ticket_id)
        result = ai_service.fallback_result("Error interno al clasificar.", catalog=catalog)

    ai_status = "Error" if result.get("used_fallback") else "Clasificado"

    try:
        with get_connection() as conn:
            allowed, category_db, priority_db = _values_allowed_in_db(
                conn,
                category=result["departamento"],
                priority=result["prioridad_db"],
            )
            if not allowed:
                logger.error(
                    "IA: rechazo persistencia ticket_id=%s category=%r priority=%r "
                    "(valores no presentes en BD)",
                    ticket_id,
                    result.get("departamento"),
                    result.get("prioridad_db"),
                )
                ai_status = "Error"
                result = ai_service.fallback_result(
                    "Clasificación rechazada: valores no válidos en catálogo de BD.",
                    catalog=catalog,
                )
                allowed, category_db, priority_db = _values_allowed_in_db(
                    conn,
                    category=result["departamento"],
                    priority=result["prioridad_db"],
                )
                if not allowed:
                    logger.error(
                        "IA: fallback también inválido para BD ticket_id=%s; no se actualiza",
                        ticket_id,
                    )
                    return

            updated = ticket_repository.update_ai_classification(
                conn,
                ticket_id,
                category=category_db,
                priority=priority_db,
                ai_motivo=result["motivo"],
                ai_status=ai_status,
            )
            if updated is None:
                logger.warning("IA: ticket_id=%s no actualizado (no existe o eliminado)", ticket_id)
            else:
                conn.commit()
                logger.info(
                    "IA: ticket_id=%s actualizado category=%s priority=%s fallback=%s "
                    "model=%s total_s=%s",
                    ticket_id,
                    updated.category,
                    updated.priority,
                    result.get("used_fallback"),
                    ai_service.ollama_model(),
                    result.get("ollama_total_seconds"),
                )
    except Exception:
        logger.exception("IA: error al persistir clasificación ticket_id=%s", ticket_id)


def schedule_ai_classification_after_commit(*, ticket_id: int, subject: str, body: str) -> None:
    """
    Lanza la clasificación en un hilo daemon para no bloquear el worker de correo
    ni el hilo principal de Flask.
    """
    t = threading.Thread(
        target=_run_classification,
        args=(ticket_id, subject, body),
        name=f"ticket-ai-{ticket_id}",
        daemon=True,
    )
    t.start()
    logger.info("IA: clasificación programada en hilo ticket_id=%s", ticket_id)
