const pool = require('../db')

const getProductos = () => pool.query(`
  SELECT pr.*,
    tp.nombre AS tipo_producto,
    vp.nombre AS variante_producto
  FROM tbd_producto pr
  LEFT JOIN tbd_tipo_producto tp ON pr.id_tipo_producto = tp.id
  LEFT JOIN tbd_variante_producto vp ON pr.id_variante_producto = vp.id
  ORDER BY pr.id
`)

const getProductoById = (id) => pool.query(`
  SELECT pr.*,
    tp.nombre AS tipo_producto,
    vp.nombre AS variante_producto
  FROM tbd_producto pr
  LEFT JOIN tbd_tipo_producto tp ON pr.id_tipo_producto = tp.id
  LEFT JOIN tbd_variante_producto vp ON pr.id_variante_producto = vp.id
  WHERE pr.id = $1
`, [id])

// runner: permite ejecutar dentro de una transacción (client de pool.connect())
const createProductoRow = (data, runner = pool) => runner.query(`
  INSERT INTO tbd_producto (nombre_producto, id_tipo_producto, id_variante_producto, precio_producto)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`, [data.nombre_producto, data.id_tipo_producto, data.id_variante_producto, data.precio_producto])

const updateProductoRow = (id, data, runner = pool) => runner.query(`
  UPDATE tbd_producto SET
    nombre_producto = $1, id_tipo_producto = $2,
    id_variante_producto = $3, precio_producto = $4
  WHERE id = $5
  RETURNING *
`, [data.nombre_producto, data.id_tipo_producto, data.id_variante_producto, data.precio_producto, id])

// Snapshot del precio actual antes del update, para detectar si cambió.
const getProductoPrecioActual = (id, runner = pool) => runner.query(`
  SELECT precio_producto FROM tbd_producto WHERE id = $1
`, [id])

const deleteProducto = (id) => pool.query(`
  DELETE FROM tbd_producto WHERE id = $1 RETURNING *
`, [id])

// Historial de precios de un producto (ordenado por fecha ASC para gráficas)
const getHistorialPrecios = (id_producto) => pool.query(`
  SELECT id, id_producto, precio, fecha
  FROM tbd_precio_producto_historico
  WHERE id_producto = $1
  ORDER BY fecha ASC
`, [id_producto])

module.exports = {
  getProductos,
  getProductoById,
  createProductoRow,
  updateProductoRow,
  getProductoPrecioActual,
  deleteProducto,
  getHistorialPrecios,
}
