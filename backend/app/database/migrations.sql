-- Ejecutar en PgAdmin4 sobre la base de datos configurada (p. ej. helpdesk).
-- Crea la tabla users y un usuario de prueba para el login.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Datos de prueba (contraseña en texto plano solo para aprendizaje local).
INSERT INTO users (email, password, role)
VALUES ('admin@test.com', '123456', 'admin')
ON CONFLICT (email) DO NOTHING;
