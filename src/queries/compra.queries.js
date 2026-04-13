const pool = require('../db')

const getCompras = () => pool.query(`
  SELECT c.*,
    pv.id AS proveedor_id,
    p.nombre AS nombre_proveedor, p.apellido AS apellido_proveedor,
    e.nombre AS estado
  FROM tbd_compra c
  LEFT JOIN tbd_proveedores pv ON c.id_proveedor = pv.id
  LEFT JOIN tbd_persona p ON pv.id_persona = p.id
  LEFT JOIN tbd_estado e ON c.id_estado = e.id
  ORDER BY c.id
`)

const getCompraById = (id) => pool.query(`
  SELECT c.*,
    pv.id AS proveedor_id,
    p.nombre AS nombre_proveedor, p.apellido AS apellido_proveedor,
    e.nombre AS estado
  FROM tbd_compra c
  LEFT JOIN tbd_proveedores pv ON c.id_proveedor = pv.id
  LEFT JOIN tbd_persona p ON pv.id_persona = p.id
  LEFT JOIN tbd_estado e ON c.id_estado = e.id
  WHERE c.id = $1
`, [id])

const createCompra = (data) => pool.query(`
  INSERT INTO tbd_compra (id_proveedor, total_compra, fecha_compra, id_estado)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`, [data.id_proveedor, data.total_compra, data.fecha_compra, data.id_estado])

const updateCompra = (id, data) => pool.query(`
  UPDATE tbd_compra SET
    id_proveedor = $1, total_compra = $2,
    fecha_compra = $3, id_estado = $4
  WHERE id = $5
  RETURNING *
`, [data.id_proveedor, data.total_compra, data.fecha_compra, data.id_estado, id])

const deleteCompra = (id) => pool.query(`
  UPDATE tbd_compra SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = { getCompras, getCompraById, createCompra, updateCompra, deleteCompra }