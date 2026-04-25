-- =============================================================================
-- Migración 4: rellenar password_hash para el usuario de prueba admin.
-- Hash bcrypt (cost 12) de la contraseña en texto plano: 123456
-- Otros usuarios: establecer hash vía aplicación o script dedicado.
-- =============================================================================

UPDATE users
SET
    password_hash = '$2b$12$VH2Z1r7uvBkdA6eL20xCYOipDBVqKlCJKsAvo08CfnC0PP8F6rFwm'
WHERE
    LOWER(TRIM(email)) = 'admin@test.com'
    AND (
        password_hash IS NULL
        OR TRIM(password_hash) = ''
    );
