-- Catálogo dinámico de categorías de ticket (reemplaza CHECK estático en tickets.category).
-- Ejecutar tras 11_ticket_ai_ollama.sql.

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT categories_name_unique UNIQUE (name)
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_unique ON categories (LOWER(TRIM(name)));

INSERT INTO categories (name) VALUES
    ('ERP'),
    ('Infraestructura'),
    ('Soporte técnico'),
    ('Bases de datos'),
    ('Desarrollo'),
    ('Soporte TI'),
    ('Redes'),
    ('RRHH'),
    ('Contabilidad'),
    ('Compras'),
    ('Sin clasificar')
ON CONFLICT (name) DO NOTHING;

-- Categorías huérfanas en tickets existentes
INSERT INTO categories (name)
SELECT DISTINCT TRIM(t.category)
FROM tickets t
WHERE t.category IS NOT NULL
  AND TRIM(t.category) <> ''
  AND NOT EXISTS (
      SELECT 1 FROM categories c WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(t.category))
  );

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_check;

COMMENT ON TABLE categories IS 'Catálogo administrable de categorías de ticket.';
COMMENT ON COLUMN tickets.category IS 'Nombre de categoría (texto); validado contra tabla categories.';
