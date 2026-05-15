"""Modelo de dominio de usuario (sin ORM)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: int
    email: str
    role: str
    password_hash: str
    full_name: str | None = None
    corporate_email: str | None = None
    phone: str | None = None
    document_number: str | None = None
    gender: str | None = None
    department_id: int | None = None
    professional_role: str | None = None
    profile_photo: str | None = None
    is_active: bool = True
