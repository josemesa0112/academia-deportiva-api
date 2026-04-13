const pool = require('../db')

const getEntrenamientos = () => pool.query(`
  SELECT en.*,
    ca.nombre AS cancha, ca.barrio, ca.direccion,
    cat.nombre AS categoria,
    e.nombre AS estado
  FROM tbd_entrenamiento en
  LEFT JOIN tbd_cancha ca ON en.id_cancha = ca.id
  LEFT JOIN tbd_categoria cat ON en.id_categoria = cat.id
  LEFT JOIN tbd_estado e ON en.id_estado = e.id
  ORDER BY en.id
`)

const getEntrenamientoById = (id) => pool.query(`
  SELECT en.*,
    ca.nombre AS cancha, ca.barrio, ca.direccion,
    cat.nombre AS categoria,
    e.nombre AS estado
  FROM tbd_entrenamiento en
  LEFT JOIN tbd_cancha ca ON en.id_cancha = ca.id
  LEFT JOIN tbd_categoria cat ON en.id_categoria = cat.id
  LEFT JOIN tbd_estado e ON en.id_estado = e.id
  WHERE en.id = $1
`, [id])

const createEntrenamiento = (data) => pool.query(`
  INSERT INTO tbd_entrenamiento (id_cancha, id_categoria, hora_inicio, hora_fin, fecha, id_estado)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *
`, [data.id_cancha, data.id_categoria, data.hora_inicio, data.hora_fin, data.fecha, data.id_estado])

const updateEntrenamiento = (id, data) => pool.query(`
  UPDATE tbd_entrenamiento SET
    id_cancha = $1, id_categoria = $2, hora_inicio = $3,
    hora_fin = $4, fecha = $5, id_estado = $6
  WHERE id = $7
  RETURNING *
`, [data.id_cancha, data.id_categoria, data.hora_inicio, data.hora_fin, data.fecha, data.id_estado, id])

const deleteEntrenamiento = (id) => pool.query(`
  UPDATE tbd_entrenamiento SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

const getProfesoresByEntrenamiento = (id_entrenamiento) => pool.query(`
  SELECT exp.*,
    pr.id AS profesor_id,
    p.nombre, p.apellido
  FROM tbd_entrenamiento_x_profesor exp
  LEFT JOIN tbd_profesor pr ON exp.id_profesor = pr.id
  LEFT JOIN tbd_persona p ON pr.id_persona = p.id
  WHERE exp.id_entrenamiento = $1
`, [id_entrenamiento])

const addProfesorToEntrenamiento = (data) => pool.query(`
  INSERT INTO tbd_entrenamiento_x_profesor (id_profesor, id_entrenamiento)
  VALUES ($1, $2)
  RETURNING *
`, [data.id_profesor, data.id_entrenamiento])

const removeProfesorFromEntrenamiento = (id) => pool.query(`
  DELETE FROM tbd_entrenamiento_x_profesor WHERE id = $1 RETURNING *
`, [id])

module.exports = {
  getEntrenamientos, getEntrenamientoById, createEntrenamiento,
  updateEntrenamiento, deleteEntrenamiento, getProfesoresByEntrenamiento,
  addProfesorToEntrenamiento, removeProfesorFromEntrenamiento
}