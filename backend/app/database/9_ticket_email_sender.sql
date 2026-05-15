-- Remitente del correo en tickets (idempotencia sigue en email_message_id).
-- Idempotente: ADD COLUMN IF NOT EXISTS.

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS sender_name TEXT;

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS sender_email TEXT;

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS raw_from TEXT;

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS sender_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_sender_email_lower
    ON tickets ((LOWER(TRIM(sender_email))))
    WHERE sender_email IS NOT NULL AND TRIM(sender_email) <> '';

CREATE INDEX IF NOT EXISTS idx_tickets_sender_user_id ON tickets (sender_user_id)
    WHERE sender_user_id IS NOT NULL;

COMMENT ON COLUMN tickets.sender_name IS 'Nombre del remitente (parseaddr / cabecera From decodificada).';
COMMENT ON COLUMN tickets.sender_email IS 'Correo del remitente normalizado (minúsculas).';
COMMENT ON COLUMN tickets.raw_from IS 'Valor textual completo de la cabecera From (UTF-8 / decodificado por el parser MIME).';
COMMENT ON COLUMN tickets.sender_user_id IS 'Usuario registrado cuyo email coincide con sender_email; NULL si es externo.';
