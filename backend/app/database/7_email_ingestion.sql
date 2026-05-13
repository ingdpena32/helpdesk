-- =============================================================================
-- Migración 7: correo entrante → staging (ingestion_events), adjuntos,
-- message-id en tickets y comentarios (idempotencia).
-- Ejecutar en pgAdmin después de migraciones anteriores (users, tickets, …).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Usuario sistema para tickets/creados por correo (created_by obligatorio)
-- -----------------------------------------------------------------------------
INSERT INTO users (email, password_hash, role)
VALUES (
        'inbound@system.local',
        '$2b$12$VH2Z1r7uvBkdA6eL20xCYOipDBVqKlCJKsAvo08CfnC0PP8F6rFwm',
        'admin'
    )
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Columna: Message-ID del correo que abrió el ticket (único si no es NULL)
-- -----------------------------------------------------------------------------
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS email_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tickets_email_message_id
ON tickets (email_message_id)
WHERE email_message_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Tabla staging: eventos de webhook antes del worker
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_events (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_events_message_id
ON ingestion_events (message_id)
WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingestion_events_status_created
ON ingestion_events (status, created_at);

COMMENT ON TABLE ingestion_events IS 'Staging de correo entrante (IMAP u otros); el worker procesa pending/failed con retry_count < max.';

-- -----------------------------------------------------------------------------
-- Comentarios: soporte correo (user_id opcional) + message_id único
-- -----------------------------------------------------------------------------
ALTER TABLE ticket_comments
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE ticket_comments
ADD COLUMN IF NOT EXISTS message_id TEXT;

ALTER TABLE ticket_comments
ADD COLUMN IF NOT EXISTS author_email TEXT;

ALTER TABLE ticket_comments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_comments_message_id
ON ticket_comments (message_id)
WHERE message_id IS NOT NULL;

ALTER TABLE ticket_comments
ADD CONSTRAINT ticket_comments_author_chk CHECK (
    user_id IS NOT NULL OR (author_email IS NOT NULL AND TRIM(author_email) <> '')
);

COMMENT ON COLUMN ticket_comments.author_email IS 'Remitente cuando el comentario viene de correo (user_id NULL).';

-- -----------------------------------------------------------------------------
-- Adjuntos almacenados en disco (ruta en storage_path)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_attachments (
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

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_comment_id ON ticket_attachments (comment_id);

COMMENT ON TABLE ticket_attachments IS 'Metadatos de ficheros guardados en storage_path (ruta relativa o absoluta definida por la app).';
