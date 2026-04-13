const pool = require('../db')

const getProductosByCompra = (id_compra) => pool.query(`
  SELECT pxc.*,
    pr.nombre_producto, pr.precio_producto,
    tp.nombre AS tipo_producto,
    vp.nombre AS variante_producto
  FROM tbd_producto_x_compra pxc
  LEFT JOIN tbd_producto pr ON pxc.id_producto = pr.id
  LEFT JOIN tbd_tipo_producto tp ON pr.id_tipo_producto = tp.id
  LEFT JOIN tbd_variante_producto vp ON pr.id_variante_producto = vp.id
  WHERE pxc.id_compra = $1
`, [id_compra])

const addProductoToCompra = (data) => pool.query(`
  INSERT INTO tbd_producto_x_compra (id_producto, id_compra, cantidad_productos, precio)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`, [data.id_producto, data.id_compra, data.cantidad_productos, data.precio])

const removeProductoFromCompra = (id) => pool.query(`
  DELETE FROM tbd_producto_x_compra WHERE id = $1 RETURNING *
`, [id])

module.exports = { getProductosByCompra, addProductoToCompra, removeProductoFromCompra }