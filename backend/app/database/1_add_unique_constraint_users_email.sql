-- =============================================================================
-- Unicidad de email (normalizado). Idempotente.
-- El script base migrations.sql ya define UNIQUE (email); este índice refuerza
-- unicidad insensible a mayúsculas/espacios si no existía en bases legadas.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users ((LOWER(TRIM(email))));
