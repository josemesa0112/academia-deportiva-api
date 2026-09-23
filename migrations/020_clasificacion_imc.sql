-- 020_clasificacion_imc.sql
-- Alinea tbd_clasificacion con lo que el código espera.
--
-- El catálogo contenía niveles deportivos (Principiante / Intermedio /
-- Avanzado), pero el cálculo automático busca las categorías de IMC según la
-- OMS (bajo en grasa / saludable / sobrepeso). Como nunca encontraba
-- coincidencia, id_clasificacion quedaba en NULL para todos los deportistas:
-- la clasificación automática jamás llegó a funcionar en esta base.
--
-- Se actualizan las tres filas en su sitio en vez de borrarlas y recrearlas,
-- para no tocar los ids y no arriesgar las llaves foráneas que apuntan aquí
-- (tbd_deportista e historial_deportivo).
--
-- Idempotente: se puede re-ejecutar sin riesgo.

-- 1. Renombrar el catálogo a las categorías de IMC.
--    Los colores acompañan al significado: ámbar por debajo, verde en rango,
--    rojo por encima. Coinciden con los badges de la interfaz.
UPDATE tbd_clasificacion SET
  nombre = 'Bajo en grasa',
  color = 'Amarillo',
  descripcion = 'IMC menor a 18.5'
WHERE id = 1;

UPDATE tbd_clasificacion SET
  nombre = 'Saludable',
  color = 'Verde',
  descripcion = 'IMC entre 18.5 y 24.9'
WHERE id = 2;

UPDATE tbd_clasificacion SET
  nombre = 'Sobrepeso',
  color = 'Rojo',
  descripcion = 'IMC de 25 en adelante'
WHERE id = 3;

-- 2. Por si el catálogo estuviera vacío en otro entorno.
INSERT INTO tbd_clasificacion (id, nombre, color, descripcion)
SELECT v.id, v.nombre, v.color, v.descripcion
FROM (VALUES
  (1, 'Bajo en grasa', 'Amarillo', 'IMC menor a 18.5'),
  (2, 'Saludable',     'Verde',    'IMC entre 18.5 y 24.9'),
  (3, 'Sobrepeso',     'Rojo',     'IMC de 25 en adelante')
) AS v(id, nombre, color, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM tbd_clasificacion c WHERE c.id = v.id);

-- 3. Rellenar la clasificación de los deportistas que ya tienen IMC.
--    Hasta ahora todos estaban en NULL. Se respetan los mismos umbrales que
--    aplica el backend al crear o editar un deportista.
UPDATE tbd_deportista d SET id_clasificacion = CASE
    WHEN d.imc_actual < 18.5 THEN 1
    WHEN d.imc_actual < 25   THEN 2
    ELSE 3
  END
WHERE d.imc_actual IS NOT NULL
  AND d.imc_actual > 0
  AND d.id_clasificacion IS DISTINCT FROM (CASE
    WHEN d.imc_actual < 18.5 THEN 1
    WHEN d.imc_actual < 25   THEN 2
    ELSE 3
  END);

-- 4. La secuencia debe quedar por encima de los ids insertados a mano.
SELECT setval(
  pg_get_serial_sequence('tbd_clasificacion', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM tbd_clasificacion), 1)
);
