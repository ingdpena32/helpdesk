"""Modelo de dominio de usuario (sin ORM)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: int
    email: str
    role: str
    password_hash: str
