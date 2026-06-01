const pool = require('../db')

const getProveedores = () => pool.query(`
  SELECT pv.*,
    p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
    e.nombre AS estado,
    COALESCE(
      (SELECT json_agg(json_build_object('id', pr.id, 'nombre', pr.nombre_producto, 'precio', pr.precio_producto) ORDER BY pr.nombre_producto)
       FROM tbd_proveedor_x_producto pxp
       JOIN tbd_producto pr ON pr.id = pxp.id_producto
       WHERE pxp.id_proveedor = pv.id),
      '[]'::json
    ) AS productos
  FROM tbd_proveedores pv
  LEFT JOIN tbd_persona p ON pv.id_persona = p.id
  LEFT JOIN tbd_estado e ON pv.id_estado = e.id
  ORDER BY pv.id
`)

const getProveedorById = (id) => pool.query(`
  SELECT pv.*,
    p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
    e.nombre AS estado,
    COALESCE(
      (SELECT json_agg(json_build_object('id', pr.id, 'nombre', pr.nombre_producto, 'precio', pr.precio_producto) ORDER BY pr.nombre_producto)
       FROM tbd_proveedor_x_producto pxp
       JOIN tbd_producto pr ON pr.id = pxp.id_producto
       WHERE pxp.id_proveedor = pv.id),
      '[]'::json
    ) AS productos
  FROM tbd_proveedores pv
  LEFT JOIN tbd_persona p ON pv.id_persona = p.id
  LEFT JOIN tbd_estado e ON pv.id_estado = e.id
  WHERE pv.id = $1
`, [id])

const getProductosByProveedor = (id_proveedor) => pool.query(`
  SELECT pr.id, pr.nombre_producto AS nombre, pr.precio_producto
  FROM tbd_proveedor_x_producto pxp
  JOIN tbd_producto pr ON pr.id = pxp.id_producto
  WHERE pxp.id_proveedor = $1
  ORDER BY pr.nombre_producto
`, [id_proveedor])

// runner: permite ejecutar dentro de una transacción (pool.connect() client)
const createProveedorRow = (data, runner = pool) => runner.query(`
  INSERT INTO tbd_proveedores (id_persona, id_estado)
  VALUES ($1, $2)
  RETURNING *
`, [data.id_persona, data.id_estado])

const updateProveedorRow = (id, data, runner = pool) => runner.query(`
  UPDATE tbd_proveedores SET
    id_persona = $1, id_estado = $2
  WHERE id = $3
  RETURNING *
`, [data.id_persona, data.id_estado, id])

const deleteProveedor = (id) => pool.query(`
  UPDATE tbd_proveedores SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = {
  getProveedores,
  getProveedorById,
  getProductosByProveedor,
  createProveedorRow,
  updateProveedorRow,
  deleteProveedor,
}
