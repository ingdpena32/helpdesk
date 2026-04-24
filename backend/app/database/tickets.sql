-- -----------------------------------------------------------------------------
-- Tabla: tickets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
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
    resolution TEXT,
    closed_at TIMESTAMP,
    CONSTRAINT tickets_priority_check CHECK (priority IN ('low', 'medium', 'high')),
    CONSTRAINT tickets_status_check CHECK (status IN ('open', 'in_progress', 'closed')),
    CONSTRAINT tickets_category_check CHECK (
        category IN (
            'ERP',
            'Infraestructura',
            'Soporte técnico',
            'Bases de datos',
            'Desarrollo'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets (created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets (category);

-- Nota: en futuras actualizaciones (PATCH) el backend puede asignar updated_at = NOW().

-- -----------------------------------------------------------------------------
-- Datos de prueba: al menos un ticket de ejemplo
-- -----------------------------------------------------------------------------
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
