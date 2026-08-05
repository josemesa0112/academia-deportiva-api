-- 017_gastos.sql
-- Egresos del club que no son compras a proveedores: arriendo, servicios,
-- nómina, transporte, inscripciones a torneos, etc.
--
-- Hasta ahora "gastos del mes" en el dashboard era únicamente la suma de
-- tbd_compra. Con esta tabla el club puede registrar cualquier egreso y que
-- quede reflejado en esa cifra.
--
-- Idempotente: se puede re-ejecutar sin riesgo.

-- 1. Catálogo de tipos de gasto.
CREATE TABLE IF NOT EXISTS tbd_tipo_gasto (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tipo_gasto_nombre
  ON tbd_tipo_gasto (lower(nombre));

INSERT INTO tbd_tipo_gasto (nombre)
SELECT v.nombre FROM (VALUES
  ('Arriendo'),
  ('Servicios públicos'),
  ('Nómina y honorarios'),
  ('Transporte'),
  ('Mantenimiento'),
  ('Inscripciones y torneos'),
  ('Implementación deportiva'),
  ('Administrativo y papelería'),
  ('Otros')
) AS v(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM tbd_tipo_gasto t WHERE lower(t.nombre) = lower(v.nombre)
);

-- 2. Gastos.
--    id_estado sigue el patrón del resto del sistema: 1 activo, 2 anulado
--    (soft delete, para no perder el histórico contable).
CREATE TABLE IF NOT EXISTS tbd_gasto (
  id            SERIAL PRIMARY KEY,
  concepto      VARCHAR(150) NOT NULL,
  id_tipo_gasto INTEGER NOT NULL REFERENCES tbd_tipo_gasto(id),
  valor         NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  fecha         DATE NOT NULL,
  descripcion   TEXT,
  id_estado     INTEGER NOT NULL DEFAULT 1 REFERENCES tbd_estado(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El dashboard filtra por mes y año sobre fecha, y agrupa por tipo.
CREATE INDEX IF NOT EXISTS idx_gasto_fecha ON tbd_gasto (fecha);
CREATE INDEX IF NOT EXISTS idx_gasto_tipo  ON tbd_gasto (id_tipo_gasto);
CREATE INDEX IF NOT EXISTS idx_gasto_estado ON tbd_gasto (id_estado);