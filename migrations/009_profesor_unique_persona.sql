-- ============================================================
-- Migración 009: Un profesor por persona
--
-- Misma lógica que 008 (proveedores): UNIQUE sobre id_persona +
-- consolidación previa de duplicados (si los hubiera) moviendo las
-- asignaciones de tbd_entrenamiento_x_profesor a la fila más antigua.
-- ============================================================

BEGIN;

-- Tabla temporal con pares (drop_id, keep_id) para profesores duplicados.
-- Si no hay duplicados, queda vacía y los siguientes pasos no hacen nada.
CREATE TEMP TABLE _dup_profesor AS
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_profesor
)
SELECT r.id AS drop_id, k.id AS keep_id
FROM ranked r
JOIN ranked k ON k.id_persona = r.id_persona AND k.rn = 1
WHERE r.rn > 1;

-- 1) Mover las relaciones de entrenamiento_x_profesor del dup al keep.
--    Usamos NOT EXISTS en vez de ON CONFLICT por si la tabla no tiene
--    UNIQUE constraint sobre (id_profesor, id_entrenamiento).
INSERT INTO tbd_entrenamiento_x_profesor (id_profesor, id_entrenamiento)
SELECT DISTINCT d.keep_id, exp.id_entrenamiento
FROM _dup_profesor d
JOIN tbd_entrenamiento_x_profesor exp ON exp.id_profesor = d.drop_id
WHERE NOT EXISTS (
  SELECT 1 FROM tbd_entrenamiento_x_profesor x
  WHERE x.id_profesor = d.keep_id AND x.id_entrenamiento = exp.id_entrenamiento
);

-- 2) Borrar las relaciones huérfanas (ya migradas o redundantes).
DELETE FROM tbd_entrenamiento_x_profesor
WHERE id_profesor IN (SELECT drop_id FROM _dup_profesor);

-- 3) Borrar las filas duplicadas de profesor.
DELETE FROM tbd_profesor WHERE id IN (SELECT drop_id FROM _dup_profesor);

DROP TABLE _dup_profesor;

-- 4) Constraint UNIQUE definitivo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profesor_id_persona
  ON tbd_profesor (id_persona);

COMMIT;
