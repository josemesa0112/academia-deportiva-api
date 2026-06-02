-- ============================================================
-- Seed complementario: asignar categorías a los profesores del seed_demo.
--
-- Estrategia simple: distribuir las 5 categorías (Sub 6/8/10/12/14)
-- entre los 5 profesores activos, uno por uno. Si tienes más o menos,
-- se adapta usando ROW_NUMBER y MOD.
--
-- Es idempotente: si ya hay asignaciones, no se duplican (UNIQUE de mig 013).
-- ============================================================

BEGIN;

WITH profesores_ordenados AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM tbd_profesor
  WHERE id_estado = 1
),
categorias_sub AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM tbd_categoria
  WHERE LOWER(TRIM(nombre)) LIKE 'sub %'
),
asignaciones AS (
  -- Cada profesor toma una categoría (round-robin si hay menos categorías que profesores)
  SELECT p.id AS id_profesor, c.id AS id_categoria
  FROM profesores_ordenados p
  JOIN categorias_sub c
    ON c.rn = ((p.rn - 1) % (SELECT COUNT(*) FROM categorias_sub)) + 1
)
INSERT INTO tbd_profesor_x_categoria (id_profesor, id_categoria)
SELECT id_profesor, id_categoria FROM asignaciones
ON CONFLICT (id_profesor, id_categoria) DO NOTHING;

COMMIT;

-- Verificación
-- SELECT p.id AS profesor_id, per.nombre || ' ' || per.apellido AS profesor,
--   STRING_AGG(cat.nombre, ', ' ORDER BY cat.id) AS categorias
-- FROM tbd_profesor p
-- JOIN tbd_persona per ON per.id = p.id_persona
-- LEFT JOIN tbd_profesor_x_categoria pxc ON pxc.id_profesor = p.id
-- LEFT JOIN tbd_categoria cat ON cat.id = pxc.id_categoria
-- GROUP BY p.id, per.nombre, per.apellido
-- ORDER BY p.id;
