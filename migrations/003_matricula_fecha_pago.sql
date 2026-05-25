-- ============================================================
-- Migración 003: Pago de matrículas
-- Añade columna fecha_pago para registrar cuándo se pagó cada
-- matrícula. NULL = pendiente. Fecha = pagada (y cuándo).
-- Misma semántica que la migración 002 sobre mensualidades.
-- ============================================================

ALTER TABLE tbd_matricula
  ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP NULL;

-- Índice parcial para acelerar la búsqueda de matrículas pendientes
CREATE INDEX IF NOT EXISTS idx_matricula_pendientes
  ON tbd_matricula (id_deportista)
  WHERE fecha_pago IS NULL;

-- ============================================================
-- Siembra: las matrículas existentes con id_estado = 1 (Activo)
-- se asumen pagadas (un deportista activo presumiblemente ya pagó
-- su inscripción). Si alguna no lo estaba, puedes editarla.
-- Las inactivas quedan NULL.
-- ============================================================
UPDATE tbd_matricula
SET fecha_pago = NOW()
WHERE id_estado = 1 AND fecha_pago IS NULL;
