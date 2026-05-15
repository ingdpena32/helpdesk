-- =============================================================================
-- 10: Departamentos, perfil extendido de agentes, transferencias y auditoría
-- Compatible con PostgreSQL. Ejecutar después de 9_ticket_email_sender.sql
-- =============================================================================

-- Departamentos alineados con categorías de tickets existentes
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    CONSTRAINT departments_name_unique UNIQUE (name)
);

INSERT INTO departments (name) VALUES
    ('ERP'),
    ('Infraestructura'),
    ('Soporte técnico'),
    ('Bases de datos'),
    ('Desarrollo')
ON CONFLICT (name) DO NOTHING;

-- Perfil de usuario / agente
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS corporate_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments (id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users SET corporate_email = email WHERE corporate_email IS NULL OR TRIM(corporate_email) = '';

ALTER TABLE users ALTER COLUMN corporate_email SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_gender_chk'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_gender_chk CHECK (
            gender IS NULL OR gender IN ('male', 'female', 'other', 'unspecified')
        );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_corporate_email_lower
    ON users ((LOWER(TRIM(corporate_email))));

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_document_number_trim
    ON users ((TRIM(document_number)))
    WHERE document_number IS NOT NULL AND TRIM(document_number) <> '';

CREATE INDEX IF NOT EXISTS idx_users_department_id ON users (department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active) WHERE is_active;

-- Metadatos de última transferencia en ticket
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transferred_by INTEGER REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_tickets_transferred_at ON tickets (transferred_at) WHERE transferred_at IS NOT NULL;

-- Historial / auditoría genérica de tickets
CREATE TABLE IF NOT EXISTS ticket_audit_events (
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

CREATE INDEX IF NOT EXISTS idx_ticket_audit_ticket_created
    ON ticket_audit_events (ticket_id, created_at DESC);

COMMENT ON COLUMN users.professional_role IS 'Rol o cargo profesional del agente (distinto del rol de permisos en users.role).';
COMMENT ON COLUMN tickets.transferred_by IS 'Usuario que ejecutó la última transferencia explícita (PUT /tickets/{id}/transfer).';
COMMENT ON TABLE ticket_audit_events IS 'Auditoría de acciones relevantes sobre tickets (transferencias, etc.).';
