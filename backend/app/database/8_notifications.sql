-- =============================================================================
-- Migración 8: notificaciones por usuario (tickets nuevos, asignación, comentarios).
-- Ejecutar después de 7_email_ingestion.sql (requiere users, tickets).
--
-- IMPORTANTE (pgAdmin):
-- - Ejecuta SOLO el contenido de ESTE archivo sobre una BD que ya tenga users/tickets.
-- - Si ves: ERROR: relation "users" already exists → no estás ejecutando solo este
--   archivo: seguramente se coló schema.sql, migrations.sql u otro script con
--   CREATE TABLE users en la misma pestaña o en el mismo lote.
-- - Abre únicamente 8_notifications.sql, selecciona todo (Ctrl+A) y F5; o ejecuta
--   solo el bloque CREATE TABLE notifications más abajo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
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

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id)
    WHERE NOT is_read;

COMMENT ON TABLE notifications IS 'Alertas por usuario (campana UI); datos de ticket se enriquecen por JOIN al listar.';
