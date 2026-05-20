-- =============================================================================
-- schema.sql — Esquema completo actual (PostgreSQL / pgAdmin 4)
--
-- Equivalente al estado tras aplicar en orden:
--   migrations.sql, tickets.sql, 1_add_unique_constraint_users_email.sql,
--   1_create_sessions_table.sql, 2_add_deleted_at_to_tickets.sql,
--   2_create_ticket_comments.sql, 3_add_users_password_hash_column.sql,
--   4_backfill_admin_password_hash.sql, 5_drop_users_password_column.sql,
--   6_seed_agent_user.sql, 7_email_ingestion.sql, 8_notifications.sql,
--   9_ticket_email_sender.sql, 10_agents_departments_audit.sql, 11_ticket_ai_ollama.sql
--
-- Uso: crear una base vacía (p. ej. CREATE DATABASE helpdesk;) y ejecutar
-- este script una vez. No está pensado para fusionar con BDs ya migradas
-- por pasos (usar las migraciones numeradas en ese caso).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- departments (alineado con categorías de tickets)
-- -----------------------------------------------------------------------------
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    CONSTRAINT departments_name_unique UNIQUE (name)
);

-- -----------------------------------------------------------------------------
-- users (contraseña solo como bcrypt; sin columna password en texto plano)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    full_name TEXT,
    corporate_email TEXT NOT NULL,
    phone TEXT,
    document_number TEXT,
    gender TEXT,
    department_id INTEGER REFERENCES departments (id) ON DELETE SET NULL,
    professional_role TEXT,
    profile_photo TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_gender_chk CHECK (
        gender IS NULL OR gender IN ('male', 'female', 'other', 'unspecified')
    )
);

CREATE UNIQUE INDEX uq_users_email_lower ON users ((LOWER(TRIM(email))));
CREATE UNIQUE INDEX uq_users_corporate_email_lower ON users ((LOWER(TRIM(corporate_email))));
CREATE UNIQUE INDEX uq_users_document_number_trim ON users ((TRIM(document_number)))
WHERE document_number IS NOT NULL AND TRIM(document_number) <> '';
CREATE INDEX idx_users_department_id ON users (department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_users_is_active ON users (is_active) WHERE is_active;

-- -----------------------------------------------------------------------------
-- sessions (JWT persistido: access + refresh)
-- -----------------------------------------------------------------------------
CREATE TABLE sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    access_token TEXT NOT NULL UNIQUE,
    refresh_token TEXT NOT NULL UNIQUE,
    access_expires_at TIMESTAMP NOT NULL,
    refresh_expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_access_token ON sessions (access_token);
CREATE INDEX idx_sessions_refresh_token ON sessions (refresh_token);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);

-- -----------------------------------------------------------------------------
-- categories (catálogo administrable)
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT categories_name_unique UNIQUE (name)
);

CREATE UNIQUE INDEX categories_name_lower_unique ON categories (LOWER(TRIM(name)));

-- -----------------------------------------------------------------------------
-- tickets
-- -----------------------------------------------------------------------------
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    priority TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_to INTEGER REFERENCES users (id) ON DELETE SET NULL,
    transferred_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
    transferred_at TIMESTAMP,
    resolution TEXT,
    closed_at TIMESTAMP,
    deleted_at TIMESTAMP,
    email_message_id TEXT,
    sender_name TEXT,
    sender_email TEXT,
    raw_from TEXT,
    sender_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
    ai_status TEXT NOT NULL DEFAULT 'Sin IA',
    ai_motivo TEXT,
    CONSTRAINT tickets_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT tickets_status_check CHECK (status IN ('open', 'in_progress', 'closed'))
);

COMMENT ON COLUMN tickets.category IS 'Nombre de categoría; validado contra tabla categories.';

CREATE UNIQUE INDEX uq_tickets_email_message_id ON tickets (email_message_id)
WHERE email_message_id IS NOT NULL;

CREATE INDEX idx_tickets_sender_email_lower ON tickets ((LOWER(TRIM(sender_email))))
WHERE sender_email IS NOT NULL AND TRIM(sender_email) <> '';

CREATE INDEX idx_tickets_sender_user_id ON tickets (sender_user_id)
WHERE sender_user_id IS NOT NULL;

CREATE INDEX idx_tickets_created_by ON tickets (created_by);
CREATE INDEX idx_tickets_status ON tickets (status);
CREATE INDEX idx_tickets_category ON tickets (category);
CREATE INDEX idx_tickets_deleted_at ON tickets (deleted_at);
CREATE INDEX idx_tickets_transferred_at ON tickets (transferred_at) WHERE transferred_at IS NOT NULL;

COMMENT ON COLUMN tickets.ai_status IS 'Estado clasificación IA: Sin IA, Procesando IA, Clasificado, Error.';
COMMENT ON COLUMN tickets.ai_motivo IS 'Motivo breve de la clasificación IA.';

-- -----------------------------------------------------------------------------
-- ticket_audit_events (transferencias y otras acciones)
-- -----------------------------------------------------------------------------
CREATE TABLE ticket_audit_events (
    id BIGSERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ticket_audit_events_type_chk CHECK (
        event_type IN ('ticket_transfer', 'ticket_updated', 'ticket_comment', 'other')
    )
);

CREATE INDEX idx_ticket_audit_ticket_created ON ticket_audit_events (ticket_id, created_at DESC);

COMMENT ON COLUMN users.professional_role IS 'Rol o cargo profesional (distinto de users.role permisos).';
COMMENT ON COLUMN tickets.transferred_by IS 'Usuario que ejecutó la última transferencia explícita.';
COMMENT ON TABLE ticket_audit_events IS 'Auditoría de acciones relevantes sobre tickets.';

-- -----------------------------------------------------------------------------
-- ticket_comments (usuarios web o comentarios vía correo: user_id opcional)
-- -----------------------------------------------------------------------------
CREATE TABLE ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users (id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    message_id TEXT,
    author_email TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ticket_comments_author_chk CHECK (
        user_id IS NOT NULL OR (author_email IS NOT NULL AND TRIM(author_email) <> '')
    )
);

CREATE UNIQUE INDEX uq_ticket_comments_message_id ON ticket_comments (message_id)
WHERE message_id IS NOT NULL;

CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments (ticket_id);
CREATE INDEX idx_ticket_comments_created_at ON ticket_comments (ticket_id, created_at);

COMMENT ON COLUMN ticket_comments.author_email IS 'Remitente cuando el comentario viene de correo (user_id NULL).';

-- -----------------------------------------------------------------------------
-- ticket_attachments (metadatos; ficheros en disco según storage_path)
-- -----------------------------------------------------------------------------
CREATE TABLE ticket_attachments (
    id BIGSERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES ticket_comments (id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_attachments_ticket_id ON ticket_attachments (ticket_id);
CREATE INDEX idx_ticket_attachments_comment_id ON ticket_attachments (comment_id);

COMMENT ON TABLE ticket_attachments IS 'Metadatos de ficheros guardados en storage_path (ruta relativa o absoluta definida por la app).';

-- -----------------------------------------------------------------------------
-- ingestion_events (staging IMAP / ingestión → worker)
-- -----------------------------------------------------------------------------
CREATE TABLE ingestion_events (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'duplicate')),
    payload_json JSONB NOT NULL,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_ingestion_events_message_id ON ingestion_events (message_id)
WHERE message_id IS NOT NULL;

CREATE INDEX idx_ingestion_events_status_created ON ingestion_events (status, created_at);

COMMENT ON TABLE ingestion_events IS 'Staging de correo entrante (IMAP u otros); el worker procesa pending/failed con retry_count < max.';

-- -----------------------------------------------------------------------------
-- notifications (campana UI por usuario)
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    ticket_id INTEGER NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT notifications_type_chk CHECK (
        type IN ('ticket_created', 'ticket_email', 'ticket_assigned', 'ticket_comment')
    )
);

CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id) WHERE NOT is_read;

COMMENT ON TABLE notifications IS 'Alertas por usuario; el listado enriquece prioridad/asignado desde tickets.';

-- -----------------------------------------------------------------------------
-- Datos iniciales (misma contraseña de prueba: 123456 — bcrypt cost 12)
-- Hash: $2b$12$VH2Z1r7uvBkdA6eL20xCYOipDBVqKlCJKsAvo08CfnC0PP8F6rFwm
-- -----------------------------------------------------------------------------
INSERT INTO departments (name) VALUES
    ('ERP'),
    ('Infraestructura'),
    ('Soporte técnico'),
    ('Bases de datos'),
    ('Desarrollo')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (email, password_hash, role, corporate_email, full_name)
VALUES
    ('admin@test.com', '$2b$12$VH2Z1r7uvBkdA6eL20xCYOipDBVqKlCJKsAvo08CfnC0PP8F6rFwm', 'admin', 'admin@test.com', 'Administrador demo'),
    ('agent@test.com', '$2b$12$VH2Z1r7uvBkdA6eL20xCYOipDBVqKlCJKsAvo08CfnC0PP8F6rFwm', 'agent', 'agent@test.com', 'Agente demo'),
    ('inbound@system.local', '$2b$12$VH2Z1r7uvBkdA6eL20xCYOipDBVqKlCJKsAvo08CfnC0PP8F6rFwm', 'admin', 'inbound@system.local', 'Ingesta correo')
ON CONFLICT (email) DO NOTHING;

INSERT INTO tickets (title, description, created_by, priority, category, status)
SELECT
    'Terminal lento en sucursal',
    'El equipo tarda más de cinco minutos en iniciar sesión.',
    u.id,
    'medium',
    'Soporte técnico',
    'open'
FROM users u
WHERE u.email = 'admin@test.com'
  AND NOT EXISTS (
      SELECT 1 FROM tickets t WHERE t.title = 'Terminal lento en sucursal'
  )
LIMIT 1;
