-- ============================================================
-- Migración 013: UNIQUE en tbd_profesor_x_categoria
--
-- La tabla M:N entre profesor y categoría ya existía pero sin
-- restricción de unicidad. Esta migración la añade para evitar
-- duplicados al asignar la misma categoría dos veces al mismo profesor.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_profesor_x_categoria
  ON tbd_profesor_x_categoria (id_profesor, id_categoria);
