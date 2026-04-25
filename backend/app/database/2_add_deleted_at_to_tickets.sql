-- =============================================================================
-- Soft delete: marca lógica de borrado sin eliminar filas.
-- =============================================================================

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets (deleted_at);
