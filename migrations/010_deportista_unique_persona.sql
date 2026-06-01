-- ============================================================
-- Migración 010: Un deportista por persona
--
-- UNIQUE sobre tbd_deportista(id_persona) + consolidación previa
-- de duplicados moviendo todas las tablas relacionadas:
--   - tbd_matricula        (FK simple → UPDATE)
--   - tbd_mensualidad      (UNIQUE id_deportista, mes, año → INSERT+DELETE)
--   - tbd_asistencia       (UNIQUE id_deportista, id_entrenamiento → INSERT+DELETE)
--   - tbd_deportista_x_posicion (UNIQUE id_deportista, id_posicion, CASCADE)
--   - tbd_medicion         (CASCADE → UPDATE para preservar historial)
--
-- Nota: usamos CTE inline en cada statement (no TEMP TABLE) porque el
-- SQL Editor de Supabase ejecuta cada statement en conexiones distintas.
-- Por eso la CTE "dups" se repite en cada paso — feo pero necesario.
-- ============================================================

BEGIN;

-- 1) Matrículas: UPDATE directo (sin UNIQUE conflictivo).
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_deportista
),
dups AS (
  SELECT r.id AS drop_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k ON k.id_persona = r.id_persona AND k.rn = 1
  WHERE r.rn > 1
)
UPDATE tbd_matricula
SET id_deportista = d.keep_id
FROM dups d
WHERE tbd_matricula.id_deportista = d.drop_id;

-- 2) Mensualidades: insertar las que no choquen contra el UNIQUE,
--    luego borrar las del dup (las que sí chocaban se descartan).
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_deportista
),
dups AS (
  SELECT r.id AS drop_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k ON k.id_persona = r.id_persona AND k.rn = 1
  WHERE r.rn > 1
)
INSERT INTO tbd_mensualidad (id_deportista, mes, año, valor, id_estado, fecha_pago)
SELECT d.keep_id, m.mes, m.año, m.valor, m.id_estado, m.fecha_pago
FROM dups d
JOIN tbd_mensualidad m ON m.id_deportista = d.drop_id
ON CONFLICT (id_deportista, mes, año) DO NOTHING;

WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_deportista
)
DELETE FROM tbd_mensualidad
WHERE id_deportista IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) Asistencias: mismo patrón.
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_deportista
),
dups AS (
  SELECT r.id AS drop_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k ON k.id_persona = r.id_persona AND k.rn = 1
  WHERE r.rn > 1
)
INSERT INTO tbd_asistencia (id_deportista, id_entrenamiento, id_estado)
SELECT d.keep_id, a.id_entrenamiento, a.id_estado
FROM dups d
JOIN tbd_asistencia a ON a.id_deportista = d.drop_id
ON CONFLICT (id_deportista, id_entrenamiento) DO NOTHING;

WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_deportista
)
DELETE FROM tbd_asistencia
WHERE id_deportista IN (SELECT id FROM ranked WHERE rn > 1);

-- 4) Posiciones (CASCADE limpia las restantes al borrar el deportista).
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_deportista
),
dups AS (
  SELECT r.id AS drop_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k ON k.id_persona = r.id_persona AND k.rn = 1
  WHERE r.rn > 1
)
INSERT INTO tbd_deportista_x_posicion (id_deportista, id_posicion)
SELECT d.keep_id, dxp.id_posicion
FROM dups d
JOIN tbd_deportista_x_posicion dxp ON dxp.id_deportista = d.drop_id
ON CONFLICT (id_deportista, id_posicion) DO NOTHING;

-- 5) Mediciones: UPDATE (preserva historial físico completo).
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_deportista
),
dups AS (
  SELECT r.id AS drop_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k ON k.id_persona = r.id_persona AND k.rn = 1
  WHERE r.rn > 1
)
UPDATE tbd_medicion
SET id_deportista = d.keep_id
FROM dups d
WHERE tbd_medicion.id_deportista = d.drop_id;

-- 6) Borrar los deportistas duplicados (CASCADE limpia posiciones leftover).
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_deportista
)
DELETE FROM tbd_deportista WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 7) UNIQUE definitivo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_deportista_id_persona
  ON tbd_deportista (id_persona);

COMMIT;
