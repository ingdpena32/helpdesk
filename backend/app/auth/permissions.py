"""Helpers de permisos basados en users.role (complemento a require_user)."""

from __future__ import annotations


def is_admin(role: str) -> bool:
    return (role or "").strip().lower() == "admin"


def is_agent(role: str) -> bool:
    return (role or "").strip().lower() == "agent"


def is_staff(role: str) -> bool:
    """Administrador o agente autenticado."""
    r = (role or "").strip().lower()
    return r in ("admin", "agent")


def can_manage_agent_directory(role: str) -> bool:
    """Listar agentes (vista de directorio)."""
    return is_staff(role)


def can_mutate_other_agents(role: str) -> bool:
    """Crear/editar/desactivar otros usuarios (solo admin)."""
    return is_admin(role)
