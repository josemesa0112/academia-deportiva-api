const pool = require('../db')

const getMensualidades = () => pool.query(`
  SELECT mn.*,
    p.nombre, p.apellido,
    e.nombre AS estado
  FROM tbd_mensualidad mn
  LEFT JOIN tbd_deportista d ON mn.id_deportista = d.id
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_estado e ON mn.id_estado = e.id
  ORDER BY mn.año DESC, mn.mes DESC
`)

const getMensualidadById = (id) => pool.query(`
  SELECT mn.*,
    p.nombre, p.apellido,
    e.nombre AS estado
  FROM tbd_mensualidad mn
  LEFT JOIN tbd_deportista d ON mn.id_deportista = d.id
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_estado e ON mn.id_estado = e.id
  WHERE mn.id = $1
`, [id])

const getMensualidadesByDeportista = (id_deportista) => pool.query(`
  SELECT mn.*, e.nombre AS estado
  FROM tbd_mensualidad mn
  LEFT JOIN tbd_estado e ON mn.id_estado = e.id
  WHERE mn.id_deportista = $1
  ORDER BY mn.año DESC, mn.mes DESC
`, [id_deportista])

const createMensualidad = (data) => pool.query(`
  INSERT INTO tbd_mensualidad (id_deportista, mes, año, valor, id_estado)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *
`, [data.id_deportista, data.mes, data.año, data.valor, data.id_estado])

const updateMensualidad = (id, data) => pool.query(`
  UPDATE tbd_mensualidad SET
    id_deportista = $1, mes = $2, año = $3,
    valor = $4, id_estado = $5
  WHERE id = $6
  RETURNING *
`, [data.id_deportista, data.mes, data.año, data.valor, data.id_estado, id])

const deleteMensualidad = (id) => pool.query(`
  UPDATE tbd_mensualidad SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = {
  getMensualidades, getMensualidadById, getMensualidadesByDeportista,
  createMensualidad, updateMensualidad, deleteMensualidad
}