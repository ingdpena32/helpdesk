"""Listado y alta de agentes (admin)."""

from __future__ import annotations

import re
from typing import Any, Mapping

import bcrypt
from psycopg2.errors import UniqueViolation

from app.database.db import get_connection
from app.repositories import user_repository
from app.services import auth_service


def _is_admin(role: str) -> bool:
    return (role or "").strip().lower() == "admin"


def _agent_to_json(user_id: int, email: str, role: str, workload: int) -> dict[str, Any]:
    """Contrato alineado con frontend `Agent` y AgentsPage."""
    return {
        "id": user_id,
        "user": user_id,
        "username": email,
        "email": email,
        "first_name": "",
        "last_name": "",
        "role": role,
        "is_active": True,
        "workload": workload,
    }


def list_agents(headers: Mapping[str, str]) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not _is_admin(user.role):
                return 403, {"error": "Solo administradores pueden listar agentes"}

            rows = user_repository.list_agents_with_workload(conn)
    except Exception:
        return 500, {"error": "No se pudo listar agentes."}

    results = [_agent_to_json(u.id, u.email, u.role, w) for u, w in rows]
    return 200, {
        "count": len(results),
        "next": None,
        "previous": None,
        "results": results,
    }


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_agent(headers: Mapping[str, str], body: dict[str, Any] | None) -> tuple[int, dict]:
    """POST /api/agents — solo admin; crea usuario con rol agent."""
    if body is None:
        body = {}

    try:
        with get_connection() as conn:
            actor, err_status, err_body = auth_service.require_user(conn, headers)
            if actor is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not _is_admin(actor.role):
                return 403, {"error": "Solo administradores pueden crear agentes"}

            raw_email = body.get("email")
            raw_password = body.get("password")
            if not isinstance(raw_email, str) or not raw_email.strip():
                return 400, {"error": "email es obligatorio"}
            email = raw_email.strip().lower()
            if len(email) > 254 or not _EMAIL_RE.match(email):
                return 400, {"error": "email no válido"}
            if not isinstance(raw_password, str):
                return 400, {"error": "password debe ser texto"}
            if len(raw_password) < 6:
                return 400, {"error": "password debe tener al menos 6 caracteres"}

            pw_hash = bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

            try:
                user = user_repository.insert_user(conn, email=email, password_hash=pw_hash, role="agent")
                conn.commit()
            except UniqueViolation:
                conn.rollback()
                return 409, {"error": "Ya existe un usuario con ese email"}
    except Exception:
        return 500, {"error": "No se pudo crear el agente."}

    return 201, _agent_to_json(user.id, user.email, user.role, 0)
