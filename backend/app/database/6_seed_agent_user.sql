-- =============================================================================
-- Migración 6: usuario agente de demostración (misma contraseña que admin: 123456).
-- Mismo hash bcrypt que en 4_backfill_admin_password_hash.sql
-- Requiere columna password_hash y sin columna password (post migración 5).
-- =============================================================================

INSERT INTO users (email, password_hash, role)
VALUES (
        'agent@test.com',
        '$2b$12$VH2Z1r7uvBkdA6eL20xCYOipDBVqKlCJKsAvo08CfnC0PP8F6rFwm',
        'agent'
    )
ON CONFLICT (email) DO NOTHING;
