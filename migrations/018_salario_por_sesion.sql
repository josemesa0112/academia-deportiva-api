-- 018_salario_por_sesion.sql
-- El pago al profesor deja de ser un salario fijo: se calcula como
-- (sesiones dictadas) x (valor por sesión).
--
-- La columna tbd_profesor.salario NO se elimina: conserva el valor fijo que
-- se venía manejando, como referencia histórica. La aplicación deja de usarla
-- para calcular el pago.
--
-- Idempotente: se puede re-ejecutar sin riesgo.

-- 1. Tarifa por sesión de cada profesor. Por defecto 40, que es la tarifa
--    acordada; se puede ajustar por profesor desde la interfaz.
ALTER TABLE tbd_profesor
  ADD COLUMN IF NOT EXISTS valor_sesion NUMERIC(12,2) NOT NULL DEFAULT 40;

-- 2. Una sesión no puede contarse dos veces para el mismo profesor. Hasta
--    ahora nada lo impedía, y con el pago calculado por conteo un duplicado
--    se traduce en dinero de más.
DO $$
DECLARE
  duplicados INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicados FROM (
    SELECT id_profesor, id_entrenamiento
      FROM tbd_entrenamiento_x_profesor
     GROUP BY id_profesor, id_entrenamiento
    HAVING COUNT(*) > 1
  ) x;

  IF duplicados > 0 THEN
    RAISE NOTICE 'ATENCION: % par(es) profesor/entrenamiento duplicados. No se crea el indice unico.', duplicados;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_entrenamiento_x_profesor
      ON tbd_entrenamiento_x_profesor (id_profesor, id_entrenamiento);
    RAISE NOTICE 'Indice unico (id_profesor, id_entrenamiento) creado.';
  END IF;
END $$;

-- 3. El conteo de sesiones por profesor es ahora una consulta caliente.
CREATE INDEX IF NOT EXISTS idx_entrenamiento_x_profesor_profesor
  ON tbd_entrenamiento_x_profesor (id_profesor);

-- 4. Las sesiones se filtran por fecha para separar dictadas de programadas.
CREATE INDEX IF NOT EXISTS idx_entrenamiento_fecha
  ON tbd_entrenamiento (fecha);
