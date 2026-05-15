"""Departamentos."""

from __future__ import annotations

from typing import Any

from psycopg2.extensions import connection as PGConnection

from app.models.department import Department


def list_all(conn: PGConnection) -> list[Department]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM departments ORDER BY name")
        rows = cur.fetchall()
    return [Department(id=int(r[0]), name=str(r[1])) for r in rows]


def find_by_id(conn: PGConnection, department_id: int) -> Department | None:
    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM departments WHERE id = %s LIMIT 1", (department_id,))
        row = cur.fetchone()
    if row is None:
        return None
    return Department(id=int(row[0]), name=str(row[1]))
