"""Categoría de ticket (catálogo administrable)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Category:
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
