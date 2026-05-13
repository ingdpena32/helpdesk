"""Comentario en un ticket."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class TicketComment:
    id: int
    ticket_id: int
    user_id: Optional[int]
    body: str
    created_at: datetime
