const pool = require('../db')

const getMedicionesByDeportista = (id_deportista) => pool.query(`
  SELECT id, id_deportista, peso, estatura, imc, porcentaje_grasa, fecha
  FROM tbd_medicion
  WHERE id_deportista = $1
  ORDER BY fecha ASC
`, [id_deportista])

const getPosicionesByDeportista = (id_deportista) => pool.query(`
  SELECT pos.id, pos.nombre
  FROM tbd_deportista_x_posicion dxp
  JOIN tbd_posicion pos ON dxp.id_posicion = pos.id
  WHERE dxp.id_deportista = $1
  ORDER BY pos.id
`, [id_deportista])

module.exports = {
  getMedicionesByDeportista,
  getPosicionesByDeportista,
}
