"""Departamento (alineado con categorías de negocio)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Department:
    id: int
    name: str
