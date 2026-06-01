-- ============================================================
-- Migración 011: Historial de precios de productos
--
-- Hasta hoy:
--   - tbd_producto.precio_producto: precio vigente (mutable, se sobreescribe).
--   - tbd_producto_x_compra.precio: snapshot del precio al momento de
--     cada compra (preservado).
--
-- Brecha: si nadie compró entre dos cambios de precio, no queda evidencia
-- de que el precio cambió. Esta tabla cubre esa brecha registrando cada
-- precio distinto que ha tenido un producto a lo largo del tiempo.
--
-- Convención: cada fila representa el precio del producto "a partir de
-- esa fecha". El más reciente es el vigente (debe coincidir con
-- tbd_producto.precio_producto).
-- ============================================================

CREATE TABLE IF NOT EXISTS tbd_precio_producto_historico (
  id SERIAL PRIMARY KEY,
  id_producto INT NOT NULL REFERENCES tbd_producto(id) ON DELETE CASCADE,
  precio DECIMAL(10,2) NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_precio_historico_producto_fecha
  ON tbd_precio_producto_historico (id_producto, fecha DESC);

-- ============================================================
-- Siembra: una fila inicial por producto existente (precio actual
-- con fecha = NOW). Solo si todavía no tiene historial.
-- ============================================================
INSERT INTO tbd_precio_producto_historico (id_producto, precio, fecha)
SELECT p.id, p.precio_producto, NOW()
FROM tbd_producto p
WHERE p.precio_producto IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tbd_precio_producto_historico h
    WHERE h.id_producto = p.id
  );
