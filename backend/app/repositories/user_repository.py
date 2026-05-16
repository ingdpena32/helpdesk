"""Acceso a datos de usuarios. Solo SQL y mapeo a modelos."""

from __future__ import annotations

from typing import Any

from psycopg2.extensions import connection as PGConnection

from app.models.user import User

_USER_ROW_SELECT = """
    u.id, u.email, u.password_hash, u.role,
    u.full_name, u.corporate_email, u.phone, u.document_number, u.gender,
    u.department_id, u.professional_role, u.profile_photo, u.is_active
"""

# INSERT/UPDATE ... RETURNING no admite alias de tabla (p. ej. "u."); solo nombres de columna.
_USER_ROW_RETURNING = """
    id, email, password_hash, role,
    full_name, corporate_email, phone, document_number, gender,
    department_id, professional_role, profile_photo, is_active
"""


def _row_to_user(row: tuple[Any, ...]) -> User:
    (
        uid,
        em,
        ph,
        role,
        full_name,
        corporate_email,
        phone,
        document_number,
        gender,
        department_id,
        professional_role,
        profile_photo,
        is_active,
    ) = row
    return User(
        id=int(uid),
        email=str(em),
        password_hash=str(ph) if ph is not None else "",
        role=str(role),
        full_name=str(full_name) if full_name is not None else None,
        corporate_email=str(corporate_email) if corporate_email is not None else None,
        phone=str(phone) if phone is not None else None,
        document_number=str(document_number) if document_number is not None else None,
        gender=str(gender) if gender is not None else None,
        department_id=int(department_id) if department_id is not None else None,
        professional_role=str(professional_role) if professional_role is not None else None,
        profile_photo=str(profile_photo) if profile_photo is not None else None,
        is_active=bool(is_active),
    )


def insert_user(
    conn: PGConnection,
    *,
    email: str,
    password_hash: str,
    role: str,
    corporate_email: str | None = None,
    full_name: str | None = None,
    phone: str | None = None,
    document_number: str | None = None,
    gender: str | None = None,
    department_id: int | None = None,
    professional_role: str | None = None,
) -> User:
    """Inserta usuario (email y corporate_email ya normalizados por el servicio)."""
    corp = (corporate_email or email).strip().lower()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO users (
                email, password_hash, role, corporate_email, full_name, phone,
                document_number, gender, department_id, professional_role
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING {_USER_ROW_RETURNING.strip()}
            """,
            (
                email,
                password_hash,
                role,
                corp,
                full_name,
                phone,
                document_number,
                gender,
                department_id,
                professional_role,
            ),
        )
        row = cur.fetchone()
    if row is None:
        raise RuntimeError("INSERT users no devolvió fila")
    return _row_to_user(row)


def find_by_email(conn: PGConnection, email: str) -> User | None:
    normalized = email.strip().lower()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {_USER_ROW_SELECT.strip()}
            FROM users u
            WHERE LOWER(TRIM(u.email)) = %s
            LIMIT 1
            """,
            (normalized,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_user(row)


def find_by_id(conn: PGConnection, user_id: int) -> User | None:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {_USER_ROW_SELECT.strip()}
            FROM users u
            WHERE u.id = %s
            LIMIT 1
            """,
            (user_id,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_user(row)


def list_agents_with_workload(
    conn: PGConnection,
    *,
    include_inactive: bool = False,
) -> list[tuple[User, int, str | None]]:
    """
    Personal operativo (rol agente o administrador) y carga de tickets abiertos/en progreso.
    Los administradores se listan como agentes operativos con permisos extra en la aplicación.
    """
    active_filter = "" if include_inactive else "AND COALESCE(u.is_active, TRUE) = TRUE"
    sql = f"""
        SELECT u.id, u.email, u.password_hash, u.role,
               u.full_name, u.corporate_email, u.phone, u.document_number, u.gender,
               u.department_id, u.professional_role, u.profile_photo, u.is_active,
               COALESCE(
                   (
                       SELECT COUNT(*)::int
                       FROM tickets t
                       WHERE t.assigned_to = u.id
                         AND t.status IN ('open', 'in_progress')
                         AND t.deleted_at IS NULL
                   ),
                   0
               ) AS workload,
               d.name AS department_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE LOWER(TRIM(u.role)) IN ('agent', 'admin')
        {active_filter}
        ORDER BY u.email
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    out: list[tuple[User, int, str | None]] = []
    for row in rows:
        *u_cols, workload, dept_name = row
        u = _row_to_user(tuple(u_cols))
        out.append((u, int(workload), str(dept_name) if dept_name is not None else None))
    return out


def list_agents_for_transfer(conn: PGConnection) -> list[User]:
    """Agentes y admins activos elegibles como asignatarios."""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {_USER_ROW_SELECT.strip()}
            FROM users u
            WHERE LOWER(TRIM(u.role)) IN ('agent', 'admin')
              AND COALESCE(u.is_active, TRUE)
            ORDER BY u.email
            """
        )
        rows = cur.fetchall()
    return [_row_to_user(r) for r in rows]


def list_admin_and_agent_user_ids(
    conn: PGConnection,
    *,
    exclude_user_ids: set[int] | None = None,
    exclude_email_lower: str | None = None,
) -> list[int]:
    """IDs de usuarios admin o agente activos (para fan-out de notificaciones)."""
    ex = exclude_user_ids or set()
    skip_email = (exclude_email_lower or "").strip().lower()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email FROM users
            WHERE LOWER(TRIM(role)) IN ('admin', 'agent')
              AND COALESCE(is_active, TRUE)
            ORDER BY id
            """
        )
        rows = cur.fetchall()
    out: list[int] = []
    for uid, em in rows:
        i = int(uid)
        if i in ex:
            continue
        if skip_email and str(em).strip().lower() == skip_email:
            continue
        out.append(i)
    return out


def count_admins(conn: PGConnection) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)::int FROM users
            WHERE LOWER(TRIM(role)) = 'admin' AND COALESCE(is_active, TRUE)
            """
        )
        row = cur.fetchone()
    return int(row[0]) if row else 0


_MISSING = object()


def update_profile_fields(
    conn: PGConnection,
    user_id: int,
    *,
    full_name: Any = _MISSING,
    phone: Any = _MISSING,
    gender: Any = _MISSING,
    corporate_email: Any = _MISSING,
    document_number: Any = _MISSING,
    department_id: Any = _MISSING,
    professional_role: Any = _MISSING,
    profile_photo: Any = _MISSING,
    role: Any = _MISSING,
    is_active: Any = _MISSING,
    password_hash: Any = _MISSING,
) -> User | None:
    """Solo actualiza argumentos distintos de _MISSING (None escribe NULL en columnas nullable)."""
    sets: list[str] = []
    params: list[Any] = []
    if full_name is not _MISSING:
        sets.append("full_name = %s")
        params.append(full_name)
    if phone is not _MISSING:
        sets.append("phone = %s")
        params.append(phone)
    if gender is not _MISSING:
        sets.append("gender = %s")
        params.append(gender)
    if corporate_email is not _MISSING:
        sets.append("corporate_email = %s")
        params.append(corporate_email)
    if document_number is not _MISSING:
        sets.append("document_number = %s")
        params.append(document_number)
    if department_id is not _MISSING:
        sets.append("department_id = %s")
        params.append(department_id)
    if professional_role is not _MISSING:
        sets.append("professional_role = %s")
        params.append(professional_role)
    if profile_photo is not _MISSING:
        sets.append("profile_photo = %s")
        params.append(profile_photo)
    if role is not _MISSING:
        sets.append("role = %s")
        params.append(role)
    if is_active is not _MISSING:
        sets.append("is_active = %s")
        params.append(is_active)
    if password_hash is not _MISSING:
        sets.append("password_hash = %s")
        params.append(password_hash)
    if not sets:
        return find_by_id(conn, user_id)
    params.append(user_id)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE users SET {", ".join(sets)}
            WHERE id = %s
            RETURNING {_USER_ROW_RETURNING.strip()}
            """,
            tuple(params),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_user(row)


def deactivate_user(conn: PGConnection, user_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE users SET is_active = FALSE WHERE id = %s AND COALESCE(is_active, TRUE)
            RETURNING id
            """,
            (user_id,),
        )
        return cur.fetchone() is not None
