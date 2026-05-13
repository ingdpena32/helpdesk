"""Elimina etiquetas HTML de forma conservadora (solo stdlib)."""

from __future__ import annotations

import re
from html.parser import HTMLParser


class _Stripper(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []

    def handle_data(self, data: str) -> None:
        self._chunks.append(data)

    def get_text(self) -> str:
        return "".join(self._chunks)


def strip_html(html: str) -> str:
    if not html:
        return ""
    parser = _Stripper()
    try:
        parser.feed(html)
        parser.close()
        text = parser.get_text()
    except Exception:
        text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def sanitize_body_html(html: str) -> str:
    """Para almacenar como texto seguro: convierte a texto plano."""
    return strip_html(html)
