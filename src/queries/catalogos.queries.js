const pool = require('../db')

const getEstados = () => pool.query('SELECT * FROM tbd_estado ORDER BY id')
const getRoles = () => pool.query('SELECT * FROM tbd_rol ORDER BY id')
const getGeneros = () => pool.query('SELECT * FROM tbd_genero ORDER BY id')
const getTiposDocumento = () => pool.query('SELECT * FROM tbd_tipo_documento ORDER BY id')
const getClasificaciones = () => pool.query('SELECT * FROM tbd_clasificacion ORDER BY id')
const getCategorias = () => pool.query('SELECT * FROM tbd_categoria ORDER BY id')
const getPosiciones = () => pool.query('SELECT * FROM tbd_posicion ORDER BY id')
const getTiposProducto = () => pool.query('SELECT * FROM tbd_tipo_producto ORDER BY id')
const getVariantesProducto = () => pool.query('SELECT * FROM tbd_variante_producto ORDER BY id')

module.exports = {
  getEstados,
  getRoles,
  getGeneros,
  getTiposDocumento,
  getClasificaciones,
  getCategorias,
  getPosiciones,
  getTiposProducto,
  getVariantesProducto
}