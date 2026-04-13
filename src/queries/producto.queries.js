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

const createProducto = (data) => pool.query(`
  INSERT INTO tbd_producto (nombre_producto, id_tipo_producto, id_variante_producto, precio_producto)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`, [data.nombre_producto, data.id_tipo_producto, data.id_variante_producto, data.precio_producto])

const updateProducto = (id, data) => pool.query(`
  UPDATE tbd_producto SET
    nombre_producto = $1, id_tipo_producto = $2,
    id_variante_producto = $3, precio_producto = $4
  WHERE id = $5
  RETURNING *
`, [data.nombre_producto, data.id_tipo_producto, data.id_variante_producto, data.precio_producto, id])

const deleteProducto = (id) => pool.query(`
  DELETE FROM tbd_producto WHERE id = $1 RETURNING *
`, [id])

module.exports = { getProductos, getProductoById, createProducto, updateProducto, deleteProducto }