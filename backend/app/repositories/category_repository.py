"""Acceso a datos del catálogo de categorías."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from psycopg2.extensions import connection as PGConnection

from app.models.category import Category


def _row_to_category(row: tuple[Any, ...]) -> Category:
    cid, name, created_at, updated_at = row
    return Category(
        id=int(cid),
        name=str(name),
        created_at=created_at,
        updated_at=updated_at,
    )


def list_all(conn: PGConnection) -> list[Category]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, created_at, updated_at FROM categories ORDER BY name ASC"
        )
        rows = cur.fetchall()
    return [_row_to_category(r) for r in rows]


def find_by_id(conn: PGConnection, category_id: int) -> Category | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, created_at, updated_at FROM categories WHERE id = %s LIMIT 1",
            (category_id,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_category(row)


def find_by_name_ci(conn: PGConnection, name: str) -> Category | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, created_at, updated_at
            FROM categories
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
            LIMIT 1
            """,
            (name,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_category(row)


def name_exists_ci(conn: PGConnection, name: str, *, exclude_id: int | None = None) -> bool:
    with conn.cursor() as cur:
        if exclude_id is None:
            cur.execute(
                "SELECT 1 FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s)) LIMIT 1",
                (name,),
            )
        else:
            cur.execute(
                """
                SELECT 1 FROM categories
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s)) AND id <> %s
                LIMIT 1
                """,
                (name, exclude_id),
            )
        return cur.fetchone() is not None


def allowed_names(conn: PGConnection) -> frozenset[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM categories")
        rows = cur.fetchall()
    return frozenset(str(r[0]) for r in rows)


def insert(conn: PGConnection, name: str) -> Category:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO categories (name)
            VALUES (%s)
            RETURNING id, name, created_at, updated_at
            """,
            (name,),
        )
        row = cur.fetchone()
    assert row is not None
    return _row_to_category(row)


def update_name(conn: PGConnection, category_id: int, new_name: str) -> Category | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT name FROM categories WHERE id = %s LIMIT 1",
            (category_id,),
        )
        old_row = cur.fetchone()
        if old_row is None:
            return None
        old_name = str(old_row[0])

        cur.execute(
            """
            UPDATE categories
            SET name = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id, name, created_at, updated_at
            """,
            (new_name, category_id),
        )
        row = cur.fetchone()
        if row is None:
            return None

        if old_name != new_name:
            cur.execute(
                "UPDATE tickets SET category = %s, updated_at = NOW() WHERE category = %s",
                (new_name, old_name),
            )
    return _row_to_category(row)


def delete_by_id(conn: PGConnection, category_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM categories WHERE id = %s", (category_id,))
        return cur.rowcount > 0


def count_tickets_with_name(conn: PGConnection, name: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)::int FROM tickets
            WHERE category = %s AND deleted_at IS NULL
            """,
            (name,),
        )
        row = cur.fetchone()
    return int(row[0]) if row else 0
