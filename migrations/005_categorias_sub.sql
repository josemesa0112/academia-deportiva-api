-- ============================================================
-- Migración 005: Renombrar categorías a sistema "Sub N"
--
-- Estado antes:                  Estado después:
--   1 Preinfantil  (vacía)         1 Sub 6
--   2 Infantil     (1 dep/mat/ent) 2 Sub 8   ← conserva referencias
--   3 Prejuvenil   (vacía)         3 Sub 10
--   4 Juvenil      (vacía)         4 Sub 12
--                                  5 Sub 14  ← nueva
--
-- Estrategia: rename + insert. Conserva todos los IDs existentes,
-- por lo que ninguna FK (tbd_deportista, tbd_matricula,
-- tbd_entrenamiento) necesita actualizarse.
--
-- Envuelto en transacción: si algo falla, no queda nada a medias.
-- ============================================================

BEGIN;

UPDATE tbd_categoria SET nombre = 'Sub 6'  WHERE id = 1 AND nombre = 'Preinfantil';
UPDATE tbd_categoria SET nombre = 'Sub 8'  WHERE id = 2 AND nombre = 'Infantil';
UPDATE tbd_categoria SET nombre = 'Sub 10' WHERE id = 3 AND nombre = 'Prejuvenil';
UPDATE tbd_categoria SET nombre = 'Sub 12' WHERE id = 4 AND nombre = 'Juvenil';

-- Insertar Sub 14 solo si no existe ya (idempotente)
INSERT INTO tbd_categoria (nombre)
SELECT 'Sub 14'
WHERE NOT EXISTS (
  SELECT 1 FROM tbd_categoria WHERE LOWER(TRIM(nombre)) = 'sub 14'
);

COMMIT;

-- ============================================================
-- Verificación (ejecútala después para confirmar el resultado)
-- ============================================================
-- SELECT c.id, c.nombre,
--   (SELECT COUNT(*) FROM tbd_deportista WHERE id_categoria = c.id) AS deportistas,
--   (SELECT COUNT(*) FROM tbd_matricula  WHERE id_categoria = c.id) AS matriculas,
--   (SELECT COUNT(*) FROM tbd_entrenamiento WHERE id_categoria = c.id) AS entrenamientos
-- FROM tbd_categoria c
-- ORDER BY c.id;
