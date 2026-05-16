-- -----------------------------------------------------------------------------
-- Clasificación IA (Ollama): estado, motivo y ampliación de categorías/prioridad
-- Ejecutar sobre una BD ya migrada hasta 10_agents_departments_audit.sql
-- -----------------------------------------------------------------------------

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_check;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_priority_check;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'Sin IA';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_motivo TEXT;

ALTER TABLE tickets ADD CONSTRAINT tickets_category_check CHECK (
    category IN (
        'ERP',
        'Infraestructura',
        'Soporte técnico',
        'Bases de datos',
        'Desarrollo',
        'Soporte TI',
        'Redes',
        'RRHH',
        'Contabilidad',
        'Compras',
        'Sin clasificar'
    )
);

ALTER TABLE tickets ADD CONSTRAINT tickets_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'critical')
);

COMMENT ON COLUMN tickets.ai_status IS 'Estado UI de clasificación IA: Sin IA, Procesando IA, Clasificado, Error.';
COMMENT ON COLUMN tickets.ai_motivo IS 'Breve motivo devuelto por la IA (o mensaje de fallback).';
