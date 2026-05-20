"""Parseo de parámetros de fecha para filtros de API (YYYY-MM-DD o ISO)."""

from __future__ import annotations

from datetime import date, datetime, time


def parse_date_param(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    """Convierte query param a datetime; fin de día inclusivo si end_of_day."""
    if value is None:
        return None
    s = value.strip()
    if not s:
        return None
    if len(s) >= 10:
        try:
            d = date.fromisoformat(s[:10])
            if end_of_day:
                return datetime.combine(d, time(23, 59, 59, 999999))
            return datetime.combine(d, time.min)
        except ValueError:
            pass
    try:
        normalized = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if end_of_day and "T" not in s and len(s) <= 10:
            return datetime.combine(dt.date(), time(23, 59, 59, 999999))
        return dt
    except ValueError:
        return None
