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

logger = logging.getLogger(__name__)


def _run_classification(ticket_id: int, subject: str, body: str) -> None:
    logger.info("IA: inicio clasificación ticket_id=%s", ticket_id)
    try:
        result: dict[str, Any] = ai_service.clasificar_ticket(subject, body)
    except Exception:
        logger.exception("IA: fallo no capturado en clasificar_ticket ticket_id=%s", ticket_id)
        result = ai_service.fallback_result("Error interno al clasificar.")

    ai_status = "Error" if result.get("used_fallback") else "Clasificado"

    try:
        with get_connection() as conn:
            updated = ticket_repository.update_ai_classification(
                conn,
                ticket_id,
                category=result["departamento"],
                priority=result["prioridad_db"],
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
