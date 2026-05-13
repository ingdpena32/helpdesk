"""Staging de eventos de correo (ingestion_events)."""

from __future__ import annotations

from typing import Any

from psycopg2.extras import Json
from psycopg2.extensions import connection as PGConnection


def insert_event(
    conn: PGConnection,
    *,
    payload: dict[str, Any],
    message_id_hint: str | None,
) -> int:
    """Inserta fila pending. payload_json se serializa desde dict Python."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ingestion_events (message_id, status, payload_json)
            VALUES (%s, 'pending', %s)
            RETURNING id
            """,
            (message_id_hint, Json(payload)),
        )
        row = cur.fetchone()
    if row is None:
        raise RuntimeError("INSERT ingestion_events no devolvió id")
    return int(row[0])


def try_find_completed_by_message_id(conn: PGConnection, message_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM ingestion_events
            WHERE message_id = %s AND status = 'completed'
            LIMIT 1
            """,
            (message_id,),
        )
        return cur.fetchone() is not None


def fetch_pending_batch(
    conn: PGConnection, *, limit: int = 10, max_retries: int = 8
) -> list[dict[str, Any]]:
    """Filas pending o failed con reintentos disponibles."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, message_id, status, payload_json, error_message, retry_count
            FROM ingestion_events
            WHERE status = 'pending'
               OR (status = 'failed' AND retry_count < %s)
            ORDER BY created_at ASC, id ASC
            LIMIT %s
            """,
            (max_retries, limit),
        )
        rows = cur.fetchall()
    out: list[dict[str, Any]] = []
    for row in rows:
        eid, mid, st, pj, err, rc = row
        if isinstance(pj, str):
            import json as _json

            payload = _json.loads(pj)
        else:
            payload = pj if isinstance(pj, dict) else {}
        out.append(
            {
                "id": int(eid),
                "message_id": mid,
                "status": st,
                "payload": payload,
                "error_message": err,
                "retry_count": int(rc or 0),
            }
        )
    return out


def mark_processing(conn: PGConnection, event_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ingestion_events
            SET status = 'processing', updated_at = NOW()
            WHERE id = %s
            """,
            (event_id,),
        )


def mark_completed(conn: PGConnection, event_id: int, *, message_id: str | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ingestion_events
            SET
                status = 'completed',
                message_id = COALESCE(%s, message_id),
                error_message = NULL,
                updated_at = NOW()
            WHERE id = %s
            """,
            (message_id, event_id),
        )


def mark_duplicate(conn: PGConnection, event_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ingestion_events
            SET status = 'duplicate', updated_at = NOW()
            WHERE id = %s
            """,
            (event_id,),
        )


def mark_failed(conn: PGConnection, event_id: int, error: str, *, increment_retry: bool) -> None:
    with conn.cursor() as cur:
        if increment_retry:
            cur.execute(
                """
                UPDATE ingestion_events
                SET
                    status = 'failed',
                    error_message = %s,
                    retry_count = retry_count + 1,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (error[:2000], event_id),
            )
        else:
            cur.execute(
                """
                UPDATE ingestion_events
                SET status = 'failed', error_message = %s, updated_at = NOW()
                WHERE id = %s
                """,
                (error[:2000], event_id),
            )


def reset_to_pending_after_failure(conn: PGConnection, event_id: int, error: str) -> None:
    """Tras fallo transaccional: vuelve a pending para reintento."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ingestion_events
            SET
                status = 'pending',
                error_message = %s,
                retry_count = retry_count + 1,
                updated_at = NOW()
            WHERE id = %s
            """,
            (error[:2000], event_id),
        )
