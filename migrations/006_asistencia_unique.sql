-- ============================================================
-- Migración 006: UNIQUE en asistencia (id_deportista, id_entrenamiento)
--
-- Regla de negocio: cada deportista tiene UNA sola asistencia por
-- entrenamiento. Para cambiar entre presente/ausente se usa la
-- funcionalidad de "Editar" sobre el grupo existente.
--
-- El frontend filtra el dropdown de creación para no mostrar
-- entrenamientos que ya tienen asistencias asociadas; esta UNIQUE
-- es la red de seguridad por si algo se cuela.
-- ============================================================

-- Detecta posibles duplicados ANTES de crear el índice. Si hay,
-- el siguiente CREATE UNIQUE fallará con un mensaje claro y deberás
-- limpiar manualmente. Verificación opcional:
--   SELECT id_deportista, id_entrenamiento, COUNT(*)
--   FROM tbd_asistencia
--   GROUP BY 1, 2
--   HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_asistencia_deportista_entrenamiento
  ON tbd_asistencia (id_deportista, id_entrenamiento);
