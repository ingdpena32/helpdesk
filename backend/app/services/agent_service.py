"""Listado, alta y administración de agentes."""

from __future__ import annotations

import logging
import re
from typing import Any, Mapping

import bcrypt
from psycopg2.errors import UniqueViolation

from app.auth import permissions
from app.database.db import get_connection
from app.repositories import department_repository, user_repository
from app.services import auth_service

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ALLOWED_GENDER = frozenset({"male", "female", "other", "unspecified"})
_ALLOWED_SYSTEM_ROLES = frozenset({"agent", "admin"})


def _role_for_json(role: str) -> str:
    r = (role or "").strip().lower()
    if r == "admin":
        return "admin"
    return "agent"


def _agent_to_json(
    user_id: int,
    email: str,
    system_role: str,
    workload: int,
    *,
    full_name: str | None = None,
    corporate_email: str | None = None,
    phone: str | None = None,
    document_number: str | None = None,
    gender: str | None = None,
    department_id: int | None = None,
    department_name: str | None = None,
    professional_role: str | None = None,
    profile_photo: str | None = None,
    is_active: bool = True,
) -> dict[str, Any]:
    display = (full_name or "").strip() or email
    return {
        "id": user_id,
        "user": user_id,
        "username": email,
        "email": email,
        "first_name": (full_name or "").split()[0] if (full_name or "").strip() else "",
        "last_name": " ".join((full_name or "").split()[1:]) if len((full_name or "").split()) > 1 else "",
        "full_name": full_name or "",
        "corporate_email": corporate_email or email,
        "phone": phone or "",
        "document_number": document_number or "",
        "gender": gender or "",
        "department_id": department_id,
        "department_name": department_name,
        "role": _role_for_json(system_role),
        "system_role": system_role.strip().lower(),
        "professional_role": professional_role or "",
        "profile_photo": profile_photo,
        "profile_photo_url": f"/api/uploads/profiles/{profile_photo.split('/')[-1]}"
        if profile_photo
        else None,
        "is_active": is_active,
        "workload": workload,
    }


def list_agents(headers: Mapping[str, str]) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.can_manage_agent_directory(user.role):
                return 403, {"error": "No autorizado para listar agentes"}

            include_inactive = permissions.is_admin(user.role)
            rows = user_repository.list_agents_with_workload(conn, include_inactive=include_inactive)
    except Exception:
        logger.exception("list_agents: error no esperado")
        return 500, {"error": "No se pudo listar agentes."}

    results = [
        _agent_to_json(
            u.id,
            u.email,
            u.role,
            w,
            full_name=u.full_name,
            corporate_email=u.corporate_email,
            phone=u.phone,
            document_number=u.document_number,
            gender=u.gender,
            department_id=u.department_id,
            department_name=dn,
            professional_role=u.professional_role,
            profile_photo=u.profile_photo,
            is_active=u.is_active,
        )
        for u, w, dn in rows
    ]
    return 200, {
        "count": len(results),
        "next": None,
        "previous": None,
        "results": results,
    }


def _normalize_optional_str(raw: Any, *, max_len: int) -> str | None:
    if raw is None:
        return None
    if not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s:
        return None
    if len(s) > max_len:
        return None
    return s


def create_agent(headers: Mapping[str, str], body: dict[str, Any] | None) -> tuple[int, dict]:
    """POST /api/agents — solo admin."""
    if body is None:
        body = {}

    try:
        with get_connection() as conn:
            actor, err_status, err_body = auth_service.require_user(conn, headers)
            if actor is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.can_mutate_other_agents(actor.role):
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

            corp_raw = body.get("corporate_email")
            corporate_email = email
            if isinstance(corp_raw, str) and corp_raw.strip():
                corporate_email = corp_raw.strip().lower()
                if len(corporate_email) > 254 or not _EMAIL_RE.match(corporate_email):
                    return 400, {"error": "corporate_email no válido"}

            full_name = _normalize_optional_str(body.get("full_name"), max_len=200)
            phone = _normalize_optional_str(body.get("phone"), max_len=40)
            doc = _normalize_optional_str(body.get("document_number"), max_len=40)
            prof_role = _normalize_optional_str(body.get("professional_role"), max_len=120)
            gender = _normalize_optional_str(body.get("gender"), max_len=20)
            if gender is not None and gender not in _ALLOWED_GENDER:
                return 400, {"error": "gender debe ser male, female, other o unspecified"}

            department_id: int | None = None
            if "department_id" in body and body.get("department_id") is not None:
                try:
                    department_id = int(body.get("department_id"))
                except (TypeError, ValueError):
                    return 400, {"error": "department_id inválido"}
                if department_repository.find_by_id(conn, department_id) is None:
                    return 400, {"error": "department_id no existe"}

            pw_hash = bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

            try:
                user = user_repository.insert_user(
                    conn,
                    email=email,
                    password_hash=pw_hash,
                    role="agent",
                    corporate_email=corporate_email,
                    full_name=full_name,
                    phone=phone,
                    document_number=doc,
                    gender=gender,
                    department_id=department_id,
                    professional_role=prof_role,
                )
                conn.commit()
            except UniqueViolation as ex:
                conn.rollback()
                msg = str(ex.pgerror or "").lower()
                if "corporate" in msg or "corporate_email" in msg:
                    return 409, {"error": "Ya existe un usuario con ese email corporativo"}
                if "document" in msg:
                    return 409, {"error": "Ya existe un usuario con ese número de documento"}
                return 409, {"error": "Ya existe un usuario con ese email"}
    except Exception:
        logger.exception("create_agent: error no esperado (p. ej. SQL o validación en BD)")
        return 500, {"error": "No se pudo crear el agente."}

    return 201, _agent_to_json(
        user.id,
        user.email,
        user.role,
        0,
        full_name=user.full_name,
        corporate_email=user.corporate_email,
        phone=user.phone,
        document_number=user.document_number,
        gender=user.gender,
        department_id=user.department_id,
        department_name=None,
        professional_role=user.professional_role,
        profile_photo=user.profile_photo,
        is_active=user.is_active,
    )


def update_agent(headers: Mapping[str, str], agent_id: int, body: dict[str, Any] | None) -> tuple[int, dict]:
    """PUT /api/agents/{id} — solo admin; no permite degradar/editar maliciosamente a otros admins."""
    if body is None:
        body = {}

    try:
        with get_connection() as conn:
            actor, err_status, err_body = auth_service.require_user(conn, headers)
            if actor is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.can_mutate_other_agents(actor.role):
                return 403, {"error": "Solo administradores pueden editar agentes"}

            target = user_repository.find_by_id(conn, agent_id)
            if target is None:
                return 404, {"error": "Usuario no encontrado"}

            if permissions.is_admin(target.role):
                return 403, {"error": "No se puede editar un administrador"}

            if (target.role or "").strip().lower() != "agent":
                return 400, {"error": "Solo se pueden editar cuentas con rol agente"}

            kwargs: dict[str, Any] = {}
            if "full_name" in body:
                kwargs["full_name"] = _normalize_optional_str(body.get("full_name"), max_len=200)
            if "phone" in body:
                kwargs["phone"] = _normalize_optional_str(body.get("phone"), max_len=40)
            if "gender" in body:
                g = _normalize_optional_str(body.get("gender"), max_len=20)
                if g is not None and g not in _ALLOWED_GENDER:
                    return 400, {"error": "gender debe ser male, female, other o unspecified"}
                kwargs["gender"] = g
            if "corporate_email" in body:
                ce = body.get("corporate_email")
                if not isinstance(ce, str) or not ce.strip():
                    return 400, {"error": "corporate_email no puede quedar vacío"}
                ce_n = ce.strip().lower()
                if len(ce_n) > 254 or not _EMAIL_RE.match(ce_n):
                    return 400, {"error": "corporate_email no válido"}
                kwargs["corporate_email"] = ce_n
            if "document_number" in body:
                kwargs["document_number"] = _normalize_optional_str(body.get("document_number"), max_len=40)
            if "professional_role" in body:
                kwargs["professional_role"] = _normalize_optional_str(body.get("professional_role"), max_len=120)
            if "department_id" in body:
                did = body.get("department_id")
                if did is None:
                    kwargs["department_id"] = None
                else:
                    try:
                        did_int = int(did)
                    except (TypeError, ValueError):
                        return 400, {"error": "department_id inválido"}
                    if department_repository.find_by_id(conn, did_int) is None:
                        return 400, {"error": "department_id no existe"}
                    kwargs["department_id"] = did_int
            if "is_active" in body:
                raw_a = body.get("is_active")
                if not isinstance(raw_a, bool):
                    return 400, {"error": "is_active debe ser booleano"}
                if raw_a is False and target.id == actor.id:
                    return 400, {"error": "No puede desactivarse a sí mismo"}
                kwargs["is_active"] = raw_a
            if "role" in body:
                nr = body.get("role")
                if not isinstance(nr, str) or nr.strip().lower() not in _ALLOWED_SYSTEM_ROLES:
                    return 400, {"error": "role debe ser agent o admin"}
                new_role = nr.strip().lower()
                if new_role == "admin":
                    return 403, {"error": "No se puede promover a administrador desde este módulo"}
                kwargs["role"] = new_role
            if "password" in body:
                pw = body.get("password")
                if pw is None:
                    return 400, {"error": "password inválido"}
                if not isinstance(pw, str) or len(pw) < 6:
                    return 400, {"error": "password debe tener al menos 6 caracteres"}
                kwargs["password_hash"] = bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode(
                    "utf-8"
                )

            try:
                u_updated = user_repository.update_profile_fields(
                    conn,
                    agent_id,
                    **kwargs,
                )
                if u_updated is None:
                    conn.rollback()
                    return 404, {"error": "Usuario no encontrado"}

                rows = user_repository.list_agents_with_workload(conn, include_inactive=True)
                workload = 0
                dept_name: str | None = None
                for u, w, dn in rows:
                    if u.id == agent_id:
                        workload = w
                        dept_name = dn
                        u_updated = u
                        break

                conn.commit()
            except UniqueViolation:
                conn.rollback()
                return 409, {"error": "Violación de unicidad (email corporativo o documento)"}
    except Exception:
        logger.exception("update_agent: error no esperado")
        return 500, {"error": "No se pudo actualizar el agente."}

    return 200, _agent_to_json(
        u_updated.id,
        u_updated.email,
        u_updated.role,
        workload,
        full_name=u_updated.full_name,
        corporate_email=u_updated.corporate_email,
        phone=u_updated.phone,
        document_number=u_updated.document_number,
        gender=u_updated.gender,
        department_id=u_updated.department_id,
        department_name=dept_name,
        professional_role=u_updated.professional_role,
        profile_photo=u_updated.profile_photo,
        is_active=u_updated.is_active,
    )


def delete_agent(headers: Mapping[str, str], agent_id: int) -> tuple[int, dict]:
    """DELETE /api/agents/{id} — desactiva agente (soft delete). Solo admin."""
    try:
        with get_connection() as conn:
            actor, err_status, err_body = auth_service.require_user(conn, headers)
            if actor is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.can_mutate_other_agents(actor.role):
                return 403, {"error": "Solo administradores pueden eliminar o desactivar agentes"}

            target = user_repository.find_by_id(conn, agent_id)
            if target is None:
                return 404, {"error": "Usuario no encontrado"}

            if permissions.is_admin(target.role):
                return 403, {"error": "No se puede eliminar o desactivar un administrador"}

            if (target.role or "").strip().lower() != "agent":
                return 400, {"error": "Solo se pueden desactivar agentes"}

            if target.id == actor.id:
                return 400, {"error": "No puede desactivarse a sí mismo"}

            ok = user_repository.deactivate_user(conn, agent_id)
            if not ok:
                conn.rollback()
                return 409, {"error": "El agente ya estaba inactivo"}
            conn.commit()
    except Exception:
        logger.exception("delete_agent: error no esperado")
        return 500, {"error": "No se pudo desactivar el agente."}

    return 200, {"status": "deactivated", "id": agent_id}


def list_departments(headers: Mapping[str, str]) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.can_manage_agent_directory(user.role):
                return 403, {"error": "No autorizado"}
            rows = department_repository.list_all(conn)
    except Exception:
        logger.exception("list_departments: error no esperado")
        return 500, {"error": "No se pudieron listar departamentos."}

    return 200, {"results": [{"id": d.id, "name": d.name} for d in rows]}
