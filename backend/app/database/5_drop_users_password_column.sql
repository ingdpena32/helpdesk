-- =============================================================================
-- Migración 5: eliminar columna password en texto plano.
-- Ejecutar solo si password_hash está rellenado para todos los usuarios que
-- deban poder iniciar sesión (ver migración 4 y usuarios adicionales).
-- =============================================================================

ALTER TABLE users
DROP COLUMN IF EXISTS password;
