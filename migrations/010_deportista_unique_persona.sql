-- ============================================================
-- Migración 010: Un deportista por persona
--
-- Misma lógica que 008/009 pero más rica porque tbd_deportista es
-- referenciada por varias tablas:
--   - tbd_matricula        (FK simple)
--   - tbd_mensualidad      (UNIQUE id_deportista, mes, año)
--   - tbd_asistencia       (UNIQUE id_deportista, id_entrenamiento)
--   - tbd_deportista_x_posicion (UNIQUE id_deportista, id_posicion, CASCADE)
--   - tbd_medicion         (CASCADE)
--
-- Para cada duplicado: las referencias se migran a la fila más
-- antigua, respetando los UNIQUE (los registros que chocarían se
-- descartan dejando la versión del "keep").
-- ============================================================

BEGIN;

CREATE TEMP TABLE _dup_deportista AS
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_deportista
)
SELECT r.id AS drop_id, k.id AS keep_id
FROM ranked r
JOIN ranked k ON k.id_persona = r.id_persona AND k.rn = 1
WHERE r.rn > 1;

-- ------------------------------------------------------------
-- Mover referencias del dup al keep en cada tabla relacionada
-- ------------------------------------------------------------

-- Matriculas: sin UNIQUE conflictivo, UPDATE directo
UPDATE tbd_matricula
SET id_deportista = d.keep_id
FROM _dup_deportista d
WHERE tbd_matricula.id_deportista = d.drop_id;

-- Mensualidades: UNIQUE (id_deportista, mes, año) — insertar lo que no choque,
-- luego borrar las del dup (las que ya estaban en keep simplemente quedan).
INSERT INTO tbd_mensualidad (id_deportista, mes, año, valor, id_estado, fecha_pago)
SELECT d.keep_id, m.mes, m.año, m.valor, m.id_estado, m.fecha_pago
FROM _dup_deportista d
JOIN tbd_mensualidad m ON m.id_deportista = d.drop_id
ON CONFLICT (id_deportista, mes, año) DO NOTHING;

DELETE FROM tbd_mensualidad
WHERE id_deportista IN (SELECT drop_id FROM _dup_deportista);

-- Asistencias: UNIQUE (id_deportista, id_entrenamiento) — mismo patrón
INSERT INTO tbd_asistencia (id_deportista, id_entrenamiento, id_estado)
SELECT d.keep_id, a.id_entrenamiento, a.id_estado
FROM _dup_deportista d
JOIN tbd_asistencia a ON a.id_deportista = d.drop_id
ON CONFLICT (id_deportista, id_entrenamiento) DO NOTHING;

DELETE FROM tbd_asistencia
WHERE id_deportista IN (SELECT drop_id FROM _dup_deportista);

-- Posiciones: UNIQUE (id_deportista, id_posicion) — mover y descartar duplicados
INSERT INTO tbd_deportista_x_posicion (id_deportista, id_posicion)
SELECT d.keep_id, dxp.id_posicion
FROM _dup_deportista d
JOIN tbd_deportista_x_posicion dxp ON dxp.id_deportista = d.drop_id
ON CONFLICT (id_deportista, id_posicion) DO NOTHING;

-- Las restantes del dup se irán solas por CASCADE al borrar el deportista.

-- Mediciones: sin UNIQUE — UPDATE directo (preserva todo el historial físico)
UPDATE tbd_medicion
SET id_deportista = d.keep_id
FROM _dup_deportista d
WHERE tbd_medicion.id_deportista = d.drop_id;

-- ------------------------------------------------------------
-- Borrar los deportistas duplicados (CASCADE limpia tablas restantes)
-- ------------------------------------------------------------
DELETE FROM tbd_deportista WHERE id IN (SELECT drop_id FROM _dup_deportista);

DROP TABLE _dup_deportista;

-- ------------------------------------------------------------
-- UNIQUE definitivo
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_deportista_id_persona
  ON tbd_deportista (id_persona);

COMMIT;
