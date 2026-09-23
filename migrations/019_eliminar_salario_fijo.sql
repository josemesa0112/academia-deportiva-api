-- 019_eliminar_salario_fijo.sql
-- Elimina tbd_profesor.salario. El pago del profesor se calcula desde la
-- migración 018 como (sesiones dictadas) x valor_sesion, así que la columna
-- quedó sin uso y mantenerla solo invita a confusión sobre cuál manda.
--
-- OJO: esto borra datos de forma permanente. Los valores que había al
-- momento de eliminarla, por si alguna vez hicieran falta:
--   profesor 1 -> 1.500.000   (ya estaba en NULL)
--   profesor 2 ->   800.000
--   profesor 3 ->   150.000
--
-- Idempotente: se puede re-ejecutar sin riesgo.

ALTER TABLE tbd_profesor DROP COLUMN IF EXISTS salario;
