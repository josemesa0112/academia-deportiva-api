const pool = require('../db')

const getProveedores = () => pool.query(`
  SELECT pv.*,
    p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
    pr.nombre_producto, e.nombre AS estado
  FROM tbd_proveedores pv
  LEFT JOIN tbd_persona p ON pv.id_persona = p.id
  LEFT JOIN tbd_producto pr ON pv.id_producto = pr.id
  LEFT JOIN tbd_estado e ON pv.id_estado = e.id
  ORDER BY pv.id
`)

const getProveedorById = (id) => pool.query(`
  SELECT pv.*,
    p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
    pr.nombre_producto, e.nombre AS estado
  FROM tbd_proveedores pv
  LEFT JOIN tbd_persona p ON pv.id_persona = p.id
  LEFT JOIN tbd_producto pr ON pv.id_producto = pr.id
  LEFT JOIN tbd_estado e ON pv.id_estado = e.id
  WHERE pv.id = $1
`, [id])

const createProveedor = (data) => pool.query(`
  INSERT INTO tbd_proveedores (id_persona, id_producto, id_estado)
  VALUES ($1, $2, $3)
  RETURNING *
`, [data.id_persona, data.id_producto, data.id_estado])

const updateProveedor = (id, data) => pool.query(`
  UPDATE tbd_proveedores SET
    id_persona = $1, id_producto = $2, id_estado = $3
  WHERE id = $4
  RETURNING *
`, [data.id_persona, data.id_producto, data.id_estado, id])

const deleteProveedor = (id) => pool.query(`
  UPDATE tbd_proveedores SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = { getProveedores, getProveedorById, createProveedor, updateProveedor, deleteProveedor }