-- =============================================================================
-- Script completo para PgAdmin4 (base de datos helpdesk u otra configurada)
-- Orden: primero users, luego tickets (FK a users).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla: users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO users (email, password, role)
VALUES ('admin@test.com', '123456', 'admin')
ON CONFLICT (email) DO NOTHING;
