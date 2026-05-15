"""Creación de notificaciones ligada a eventos de tickets."""

from __future__ import annotations

from psycopg2.extensions import connection as PGConnection

from app.email import config as email_config
from app.models.ticket import Ticket
from app.repositories import notification_repository, user_repository


def _priority_label(p: str | None) -> str:
    if not p:
        return ""
    m = {"low": "baja", "medium": "media", "high": "alta"}
    return m.get(p.lower(), p)


def notify_ticket_created_manual(conn: PGConnection, ticket: Ticket, *, exclude_user_id: int) -> None:
    """Ticket creado desde la app: avisar a admin/agente (excepto creador y usuario sistema)."""
    recipients = user_repository.list_admin_and_agent_user_ids(
        conn,
        exclude_user_ids={exclude_user_id},
        exclude_email_lower=email_config.system_inbound_user_email(),
    )
    title = f"Nuevo ticket #{ticket.id}"
    msg = f"{ticket.title} · prioridad {_priority_label(ticket.priority)} · {ticket.category}"
    rows = [(uid, ticket.id, "ticket_created", title, msg) for uid in recipients]
    notification_repository.insert_many(conn, rows)


def notify_ticket_created_email(conn: PGConnection, ticket: Ticket) -> None:
    """Ticket creado por ingestión de correo."""
    recipients = user_repository.list_admin_and_agent_user_ids(
        conn,
        exclude_user_ids=None,
        exclude_email_lower=email_config.system_inbound_user_email(),
    )
    title = f"Ticket nuevo por correo #{ticket.id}"
    msg = f"{ticket.title} · prioridad {_priority_label(ticket.priority)} · {ticket.category}"
    rows = [(uid, ticket.id, "ticket_email", title, msg) for uid in recipients]
    notification_repository.insert_many(conn, rows)


def notify_ticket_assigned(
    conn: PGConnection,
    *,
    assignee_id: int,
    ticket: Ticket,
) -> None:
    """Un agente/admin recibe un ticket asignado."""
    title = f"Ticket asignado #{ticket.id}"
    msg = f"{ticket.title} · prioridad {_priority_label(ticket.priority)}"
    notification_repository.insert_many(conn, [(assignee_id, ticket.id, "ticket_assigned", title, msg)])


def notify_ticket_comment_for_assignee(
    conn: PGConnection,
    *,
    ticket: Ticket,
    author_user_id: int | None,
    preview: str,
) -> None:
    """Comentario nuevo: notificar al agente asignado si existe y no es el autor (app). Si author_user_id es None (correo), siempre notifica al asignado."""
    aid = ticket.assigned_to
    if aid is None:
        return
    if author_user_id is not None and aid == author_user_id:
        return
    title = f"Nuevo comentario · ticket #{ticket.id}"
    msg = (preview[:200] + "…") if len(preview) > 200 else preview
    notification_repository.insert_many(conn, [(aid, ticket.id, "ticket_comment", title, msg)])
