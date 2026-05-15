"""Modelo de dominio de ticket (sin ORM)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class Ticket:
    id: int
    title: str
    description: str
    created_by: int
    priority: str
    category: str
    status: str
    created_at: datetime
    updated_at: datetime
    assigned_to: Optional[int]
    resolution: Optional[str]
    closed_at: Optional[datetime]
    deleted_at: Optional[datetime] = None
    transferred_by: Optional[int] = None
    transferred_at: Optional[datetime] = None
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    raw_from: Optional[str] = None
    sender_user_id: Optional[int] = None
