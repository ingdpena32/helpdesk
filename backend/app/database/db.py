"""Conexión a PostgreSQL (psycopg2). Sin SQL de negocio aquí."""

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Carga .env desde la carpeta backend (padre del paquete app)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_BACKEND_ROOT / ".env")


def _config() -> dict[str, str | int]:
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "dbname": os.getenv("DB_NAME", "helpdesk"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", ""),
    }


@contextmanager
def get_connection():
    """Context manager: abre y cierra una conexión por operación."""
    conn = psycopg2.connect(**_config())
    try:
        yield conn
    finally:
        conn.close()
