const pool = require('../db')

const getCanchas = () => pool.query(`
  SELECT c.*, e.nombre AS estado
  FROM tbd_cancha c
  LEFT JOIN tbd_estado e ON c.id_estado = e.id
  ORDER BY c.id
`)

const getCanchaById = (id) => pool.query(`
  SELECT c.*, e.nombre AS estado
  FROM tbd_cancha c
  LEFT JOIN tbd_estado e ON c.id_estado = e.id
  WHERE c.id = $1
`, [id])

const createCancha = (data) => pool.query(`
  INSERT INTO tbd_cancha (nombre, barrio, direccion, id_estado)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`, [data.nombre, data.barrio, data.direccion, data.id_estado])

const updateCancha = (id, data) => pool.query(`
  UPDATE tbd_cancha SET
    nombre = $1, barrio = $2, direccion = $3, id_estado = $4
  WHERE id = $5
  RETURNING *
`, [data.nombre, data.barrio, data.direccion, data.id_estado, id])

const deleteCancha = (id) => pool.query(`
  UPDATE tbd_cancha SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = { getCanchas, getCanchaById, createCancha, updateCancha, deleteCancha }