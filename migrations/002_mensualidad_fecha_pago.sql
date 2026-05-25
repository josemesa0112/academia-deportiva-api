-- ============================================================
-- Migración 002: Pago de mensualidades
-- Añade columna fecha_pago para registrar cuándo se pagó cada
-- mensualidad. NULL = pendiente. Fecha = pagada (y cuándo).
-- ============================================================

ALTER TABLE tbd_mensualidad
  ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP NULL;

-- Índice parcial para acelerar la búsqueda de pendientes
CREATE INDEX IF NOT EXISTS idx_mensualidad_pendientes
  ON tbd_mensualidad (id_deportista, mes, año)
  WHERE fecha_pago IS NULL;

-- Índice único para evitar duplicados al generar mensualidades automáticas
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mensualidad_deportista_periodo
  ON tbd_mensualidad (id_deportista, mes, año);

-- ============================================================
-- Siembra: las mensualidades existentes con id_estado = 1 (Activo,
-- que hasta hoy se interpretaba como "Pagada") reciben fecha_pago.
-- Las inactivas quedan NULL (pendientes).
-- ============================================================
UPDATE tbd_mensualidad
SET fecha_pago = NOW()
WHERE id_estado = 1 AND fecha_pago IS NULL;
