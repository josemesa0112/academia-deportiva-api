-- ============================================================
-- Migración 008: Un proveedor por persona
--
-- Regla: cada persona con rol Proveedor solo puede tener UN registro
-- en tbd_proveedores. Antes (cuando proveedor era 1:1 con producto)
-- el workaround para tener varios productos era crear varias filas
-- de proveedor — con la migración 007 eso ya no aplica.
--
-- Pasos:
--   1) Si existen filas duplicadas (mismo id_persona), las consolida
--      en la fila más antigua (id mínimo), moviendo cualquier
--      relación de productos antes de borrar las redundantes.
--   2) Crea el UNIQUE INDEX sobre id_persona.
--
-- Todo en una transacción: si algo falla, no queda nada a medias.
-- ============================================================

BEGIN;

-- ============================================================
-- Paso 1: consolidar duplicados (si los hay)
-- ============================================================

-- Para cada persona con varias filas, "ranked" identifica cuál se
-- conserva (rn=1, id más bajo) y cuáles se descartan (rn>1).
WITH ranked AS (
  SELECT id, id_persona,
    ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_proveedores
),
duplicates AS (
  SELECT r.id AS drop_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k ON k.id_persona = r.id_persona AND k.rn = 1
  WHERE r.rn > 1
)
-- Copia los productos de las filas a descartar hacia la que se queda.
-- ON CONFLICT evita duplicar si ya estaban en la keep.
INSERT INTO tbd_proveedor_x_producto (id_proveedor, id_producto)
SELECT d.keep_id, pxp.id_producto
FROM duplicates d
JOIN tbd_proveedor_x_producto pxp ON pxp.id_proveedor = d.drop_id
ON CONFLICT (id_proveedor, id_producto) DO NOTHING;

-- Borra las filas duplicadas. El ON DELETE CASCADE en
-- tbd_proveedor_x_producto (migración 007) limpia las relaciones huérfanas.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY id_persona ORDER BY id) AS rn
  FROM tbd_proveedores
)
DELETE FROM tbd_proveedores
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ============================================================
-- Paso 2: UNIQUE INDEX sobre id_persona
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proveedor_id_persona
  ON tbd_proveedores (id_persona);

COMMIT;

-- ============================================================
-- Verificación (opcional, después del COMMIT)
-- ============================================================
-- SELECT id_persona, COUNT(*) FROM tbd_proveedores GROUP BY id_persona HAVING COUNT(*) > 1;
-- (no debe devolver filas)
