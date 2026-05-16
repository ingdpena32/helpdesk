"""Perfil del usuario autenticado y foto."""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any, Mapping

from werkzeug.datastructures import FileStorage

from app.auth import permissions
from app.database.db import get_connection
from app.repositories import department_repository, user_repository
from app.services import auth_service
from app.utils.response import BinaryPayload

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_PROFILES_SUBDIR = Path("uploads") / "profiles"
_MAX_BYTES = 2 * 1024 * 1024
_FILENAME_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png)$", re.I)

_ALLOWED_GENDER = frozenset({"male", "female", "other", "unspecified"})


def _role_for_frontend(role: str) -> str:
    r = (role or "").strip().lower()
    if r == "admin":
        return "admin"
    return "agent"


def profiles_dir() -> Path:
    p = _BACKEND_ROOT / _PROFILES_SUBDIR
    p.mkdir(parents=True, exist_ok=True)
    return p


def _public_photo_url(stored_path: str | None) -> str | None:
    if not stored_path:
        return None
    name = Path(stored_path).name
    return f"/api/uploads/profiles/{name}"


def _profile_json(conn, user) -> dict[str, Any]:
    dept_name: str | None = None
    if user.department_id is not None:
        d = department_repository.find_by_id(conn, user.department_id)
        if d is not None:
            dept_name = d.name
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name or "",
        "corporate_email": user.corporate_email or user.email,
        "phone": user.phone or "",
        "document_number": user.document_number or "",
        "gender": user.gender or "",
        "department_id": user.department_id,
        "department_name": dept_name,
        "role": _role_for_frontend(user.role),
        "system_role": (user.role or "").strip().lower(),
        "professional_role": user.professional_role or "",
        "profile_photo": user.profile_photo,
        "profile_photo_url": _public_photo_url(user.profile_photo),
        "is_active": user.is_active,
    }


def get_my_profile(headers: Mapping[str, str]) -> tuple[int, dict]:
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            return 200, _profile_json(conn, user)
    except Exception:
        return 500, {"error": "No se pudo cargar el perfil."}


def patch_my_profile(headers: Mapping[str, str], body: dict[str, Any] | None) -> tuple[int, dict]:
    if body is None:
        body = {}
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            kwargs: dict[str, Any] = {}
            if "full_name" in body:
                raw = body.get("full_name")
                if raw is None:
                    kwargs["full_name"] = None
                elif isinstance(raw, str):
                    kwargs["full_name"] = raw.strip() or None
                else:
                    return 400, {"error": "full_name debe ser texto"}
            if "phone" in body:
                raw = body.get("phone")
                if raw is not None and not isinstance(raw, str):
                    return 400, {"error": "phone debe ser texto"}
                p = (raw or "").strip() if isinstance(raw, str) else ""
                if len(p) > 40:
                    return 400, {"error": "phone demasiado largo"}
                kwargs["phone"] = p or None
            if "gender" in body:
                g = body.get("gender")
                if g is not None and (not isinstance(g, str) or g.strip() not in _ALLOWED_GENDER):
                    return 400, {"error": "gender debe ser male, female, other o unspecified"}
                kwargs["gender"] = (g or "").strip() or None if isinstance(g, str) else None

            if not kwargs:
                return 200, _profile_json(conn, user)

            updated = user_repository.update_profile_fields(conn, user.id, **kwargs)
            if updated is None:
                conn.rollback()
                return 404, {"error": "Usuario no encontrado"}
            conn.commit()
            return 200, _profile_json(conn, updated)
    except Exception:
        return 500, {"error": "No se pudo actualizar el perfil."}


def upload_profile_photo(headers: Mapping[str, str], file_storage: FileStorage | None) -> tuple[int, dict]:
    if file_storage is None or file_storage.filename is None or not file_storage.filename.strip():
        return 400, {"error": "Adjunte un archivo en el campo file"}

    raw_name = file_storage.filename
    ext = Path(raw_name).suffix.lower().lstrip(".")
    if ext not in ("jpg", "jpeg", "png"):
        return 400, {"error": "Solo se permiten imágenes JPG, JPEG o PNG"}

    try:
        data = file_storage.read()
    except Exception:
        return 400, {"error": "No se pudo leer el archivo"}

    if len(data) == 0:
        return 400, {"error": "Archivo vacío"}
    if len(data) > _MAX_BYTES:
        return 400, {"error": "La imagen supera el máximo de 2MB"}

    new_name = f"{uuid.uuid4()}.{ext}"
    rel_path = str(_PROFILES_SUBDIR / new_name).replace("\\", "/")
    dest = profiles_dir() / new_name

    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}

            prev = user.profile_photo
            dest.write_bytes(data)
            updated = user_repository.update_profile_fields(conn, user.id, profile_photo=rel_path)
            if updated is None:
                conn.rollback()
                dest.unlink(missing_ok=True)
                return 404, {"error": "Usuario no encontrado"}
            conn.commit()

            if prev:
                old = _BACKEND_ROOT / Path(prev)
                try:
                    if old.is_file():
                        rel = str(prev).replace("\\", "/")
                        if rel.startswith("uploads/profiles/") or "/uploads/profiles/" in rel:
                            old.unlink()
                except OSError:
                    pass

            return 200, {
                "profile_photo": updated.profile_photo,
                "profile_photo_url": _public_photo_url(updated.profile_photo),
            }
    except Exception:
        dest.unlink(missing_ok=True)
        return 500, {"error": "No se pudo guardar la foto."}


def serve_profile_photo(headers: Mapping[str, str], filename: str) -> tuple[int, dict | BinaryPayload]:
    if not _FILENAME_RE.match(filename or ""):
        return 400, {"error": "Nombre de archivo no válido"}
    path = profiles_dir() / filename
    if not path.is_file():
        return 404, {"error": "Imagen no encontrada"}
    try:
        with get_connection() as conn:
            user, err_status, err_body = auth_service.require_user(conn, headers)
            if user is None:
                return err_status or 401, err_body or {"error": "No autorizado"}
            if not permissions.can_manage_agent_directory(user.role):
                return 403, {"error": "No autorizado"}
    except Exception:
        return 500, {"error": "No se pudo validar el acceso."}

    ext = path.suffix.lower()
    mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
    data = path.read_bytes()
    return 200, BinaryPayload(
        body=data,
        content_type=mime,
        filename=filename,
        as_attachment=False,
        cache_control="private, no-store, max-age=0",
    )
