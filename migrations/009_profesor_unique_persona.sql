-- ============================================================
-- Migración 009: Un profesor por persona
--
-- UNIQUE sobre tbd_profesor(id_persona) + consolidación previa
-- de duplicados moviendo las asignaciones de tbd_entrenamiento_x_profesor
-- a la fila más antigua.
--
-- Nota: usamos CTE inline en cada statement (en vez de TEMP TABLE)
-- porque el SQL Editor de Supabase ejecuta cada statement en
-- conexiones separadas — las tablas TEMP no sobreviven.
-- ============================================================

BEGIN;

-- 1) Mover relaciones de entrenamiento_x_profesor del dup al keep
--    (evita colisiones con un NOT EXISTS sobre el destino).
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_profesor
),
dups AS (
  SELECT r.id AS drop_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k ON k.id_persona = r.id_persona AND k.rn = 1
  WHERE r.rn > 1
)
INSERT INTO tbd_entrenamiento_x_profesor (id_profesor, id_entrenamiento)
SELECT DISTINCT d.keep_id, exp.id_entrenamiento
FROM dups d
JOIN tbd_entrenamiento_x_profesor exp ON exp.id_profesor = d.drop_id
WHERE NOT EXISTS (
  SELECT 1 FROM tbd_entrenamiento_x_profesor x
  WHERE x.id_profesor = d.keep_id AND x.id_entrenamiento = exp.id_entrenamiento
);

-- 2) Borrar las relaciones huérfanas (las del dup que ya se migraron).
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_profesor
)
DELETE FROM tbd_entrenamiento_x_profesor
WHERE id_profesor IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) Borrar las filas duplicadas de profesor.
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_profesor
)
DELETE FROM tbd_profesor WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 4) Constraint UNIQUE definitivo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profesor_id_persona
  ON tbd_profesor (id_persona);

COMMIT;
