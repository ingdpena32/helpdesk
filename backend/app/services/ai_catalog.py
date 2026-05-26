"""
Catálogo de valores permitidos para la clasificación IA, alineado con la BD.

- Categorías: tabla `categories` (nombre canónico exacto).
- Prioridades: constraint `tickets_priority_check` (low, medium, high, critical).
"""

from __future__ import annotations

from dataclasses import dataclass

from psycopg2.extensions import connection as PGConnection

from app.repositories import category_repository
from app.services.ticket_service import ALLOWED_PRIORITIES

# Claves que el modelo puede devolver en JSON (ninguna otra se aplica al ticket).
ALLOWED_MODEL_JSON_KEYS: frozenset[str] = frozenset({"departamento", "prioridad", "motivo"})

FALLBACK_CATEGORY_NAME = "Sin clasificar"
FALLBACK_PRIORITY_DB = "medium"

_PRIORITY_DB_TO_LABEL: dict[str, str] = {
    "low": "Baja",
    "medium": "Media",
    "high": "Alta",
    "critical": "Crítica",
}


@dataclass(frozen=True)
class AiCatalog:
    """Valores válidos cargados desde BD para prompt y validación post-modelo."""

    categories: frozenset[str]
    category_by_lower: dict[str, str]
    priority_labels: frozenset[str]
    fallback_category: str
    fallback_priority_db: str
    fallback_priority_label: str


def load_catalog_from_db(conn: PGConnection) -> AiCatalog:
    names = category_repository.allowed_names(conn)
    by_lower = {n.strip().lower(): n for n in names}

    fallback_category = FALLBACK_CATEGORY_NAME
    if fallback_category not in names:
        fallback_category = by_lower.get(fallback_category.strip().lower(), fallback_category)
        if fallback_category not in names and names:
            fallback_category = sorted(names)[0]

    priority_labels = frozenset(
        _PRIORITY_DB_TO_LABEL[p] for p in sorted(ALLOWED_PRIORITIES) if p in _PRIORITY_DB_TO_LABEL
    )
    fallback_priority_db = FALLBACK_PRIORITY_DB
    if fallback_priority_db not in ALLOWED_PRIORITIES:
        fallback_priority_db = "medium"

    return AiCatalog(
        categories=names,
        category_by_lower=by_lower,
        priority_labels=priority_labels,
        fallback_category=fallback_category,
        fallback_priority_db=fallback_priority_db,
        fallback_priority_label=_PRIORITY_DB_TO_LABEL[fallback_priority_db],
    )


def resolve_category_name(raw: object, catalog: AiCatalog) -> str | None:
    """Devuelve el nombre canónico de BD o None si no existe en catálogo."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    cleaned = raw.strip()
    if cleaned in catalog.categories:
        return cleaned
    return catalog.category_by_lower.get(cleaned.lower())


def resolve_priority_db(raw: object) -> str | None:
    """Normaliza prioridad del modelo a valor de columna `tickets.priority`."""
    from app.services.ticket_service import normalize_priority_value

    if not isinstance(raw, str):
        return None
    canon = normalize_priority_value(raw)
    if canon in ALLOWED_PRIORITIES:
        return canon
    return None


def priority_label_for_db(priority_db: str) -> str:
    return _PRIORITY_DB_TO_LABEL.get(priority_db, priority_db)
