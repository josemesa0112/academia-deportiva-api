-- ============================================================
-- Migración 012: Soporte para empresas en tbd_persona
--
-- Hasta hoy todo se modelaba como "persona natural", obligando a
-- llenar apellido, fecha_nacimiento y género. Esto bloqueaba el
-- registro de proveedores que son empresas (personas jurídicas).
--
-- Cambios:
--   - Columna nueva `es_empresa` (default false).
--   - `apellido` deja de ser NOT NULL (empresas no tienen apellido).
--   - Se agrega "NIT" al catálogo de tipos de documento.
--
-- Los registros existentes mantienen es_empresa = false automáticamente
-- (default). No se altera ningún dato.
-- ============================================================

BEGIN;

ALTER TABLE tbd_persona
  ADD COLUMN IF NOT EXISTS es_empresa BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tbd_persona
  ALTER COLUMN apellido DROP NOT NULL;

-- NIT: tipo de documento para personas jurídicas (3 chars, cabe en VARCHAR(10))
INSERT INTO tbd_tipo_documento (nombre)
SELECT 'NIT'
WHERE NOT EXISTS (
  SELECT 1 FROM tbd_tipo_documento WHERE LOWER(TRIM(nombre)) = 'nit'
);

COMMIT;
