-- =============================================================================
-- Migración 3: columna para contraseña hasheada (bcrypt).
-- La columna password legada sigue existiendo hasta la migración 5.
-- =============================================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;
