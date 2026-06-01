-- ============================================================
-- Migración 007: Relación M:N entre proveedor y producto
--
-- Antes: tbd_proveedores tenía una columna id_producto (1 producto
-- por proveedor). Esto forzaba duplicar filas para proveedores con
-- varios productos.
--
-- Después: tabla tbd_proveedor_x_producto. Un proveedor puede tener
-- N productos; un producto puede tener N proveedores.
--
-- Todo en una transacción para no quedar a medias.
-- ============================================================

BEGIN;

-- Tabla M:N. Sin campos extra: solo la relación.
CREATE TABLE IF NOT EXISTS tbd_proveedor_x_producto (
  id SERIAL PRIMARY KEY,
  id_proveedor INT NOT NULL REFERENCES tbd_proveedores(id) ON DELETE CASCADE,
  id_producto  INT NOT NULL REFERENCES tbd_producto(id),
  UNIQUE (id_proveedor, id_producto)
);

CREATE INDEX IF NOT EXISTS idx_pxp_id_proveedor ON tbd_proveedor_x_producto (id_proveedor);
CREATE INDEX IF NOT EXISTS idx_pxp_id_producto  ON tbd_proveedor_x_producto (id_producto);

-- ============================================================
-- Migrar datos existentes
-- ============================================================

-- a) Copiar la asignación actual de cada proveedor (la columna id_producto).
INSERT INTO tbd_proveedor_x_producto (id_proveedor, id_producto)
SELECT id, id_producto
FROM tbd_proveedores
WHERE id_producto IS NOT NULL
ON CONFLICT (id_proveedor, id_producto) DO NOTHING;

-- b) Back-fill: cada par (proveedor, producto) que aparezca en el historial
--    de compras se registra como relación válida. Esto evita que ediciones
--    de compras antiguas pierdan el producto al aplicarse la nueva
--    restricción "solo productos del proveedor".
INSERT INTO tbd_proveedor_x_producto (id_proveedor, id_producto)
SELECT DISTINCT c.id_proveedor, pxc.id_producto
FROM tbd_compra c
JOIN tbd_producto_x_compra pxc ON pxc.id_compra = c.id
WHERE c.id_proveedor IS NOT NULL
  AND pxc.id_producto IS NOT NULL
ON CONFLICT (id_proveedor, id_producto) DO NOTHING;

-- ============================================================
-- Quitar la columna vieja
-- ============================================================
ALTER TABLE tbd_proveedores DROP COLUMN IF EXISTS id_producto;

COMMIT;

-- ============================================================
-- Verificación (opcional, ejecuta después)
-- ============================================================
-- SELECT pv.id, p.nombre || ' ' || p.apellido AS proveedor,
--   COALESCE(
--     (SELECT string_agg(pr.nombre_producto, ', ')
--      FROM tbd_proveedor_x_producto pxp
--      JOIN tbd_producto pr ON pr.id = pxp.id_producto
--      WHERE pxp.id_proveedor = pv.id),
--     '(sin productos)'
--   ) AS productos
-- FROM tbd_proveedores pv
-- JOIN tbd_persona p ON p.id = pv.id_persona
-- ORDER BY pv.id;
