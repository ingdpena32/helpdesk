"""Adjunto de ticket (metadatos; bytes en disco)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class TicketAttachment:
    id: int
    ticket_id: int
    comment_id: Optional[int]
    original_filename: str
    mime_type: str
    size_bytes: int
    storage_path: str
    created_at: datetime
    updated_at: datetime
