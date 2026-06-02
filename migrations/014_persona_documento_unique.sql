-- ============================================================
-- Migración 014: numero_documento único globalmente
--
-- Hasta hoy la unicidad era por (numero_documento, id_tipo_documento)
-- a nivel de validador, lo que permitía registrar dos personas con
-- el mismo número de documento si tenían tipos distintos (ej. CC vs TI).
-- Esto es semánticamente incorrecto — un número de documento debe
-- identificar de manera única a una persona en el sistema.
--
-- Esta migración añade UNIQUE INDEX global sobre numero_documento.
-- Si la creación falla, ya hay duplicados; revisa con:
--   SELECT numero_documento, COUNT(*)
--   FROM tbd_persona
--   GROUP BY numero_documento
--   HAVING COUNT(*) > 1;
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_persona_numero_documento
  ON tbd_persona (numero_documento);
