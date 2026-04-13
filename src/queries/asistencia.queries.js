const pool = require('../db')

const getAsistencias = () => pool.query(`
  SELECT a.*,
    d.id AS deportista_id,
    p.nombre, p.apellido,
    en.fecha, en.hora_inicio, en.hora_fin,
    ca.nombre AS cancha,
    e.nombre AS estado
  FROM tbd_asistencia a
  LEFT JOIN tbd_deportista d ON a.id_deportista = d.id
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_entrenamiento en ON a.id_entrenamiento = en.id
  LEFT JOIN tbd_cancha ca ON en.id_cancha = ca.id
  LEFT JOIN tbd_estado e ON a.id_estado = e.id
  ORDER BY a.id
`)

const getAsistenciaById = (id) => pool.query(`
  SELECT a.*,
    d.id AS deportista_id,
    p.nombre, p.apellido,
    en.fecha, en.hora_inicio, en.hora_fin,
    ca.nombre AS cancha,
    e.nombre AS estado
  FROM tbd_asistencia a
  LEFT JOIN tbd_deportista d ON a.id_deportista = d.id
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_entrenamiento en ON a.id_entrenamiento = en.id
  LEFT JOIN tbd_cancha ca ON en.id_cancha = ca.id
  LEFT JOIN tbd_estado e ON a.id_estado = e.id
  WHERE a.id = $1
`, [id])

const getAsistenciasByEntrenamiento = (id_entrenamiento) => pool.query(`
  SELECT a.*,
    p.nombre, p.apellido,
    e.nombre AS estado
  FROM tbd_asistencia a
  LEFT JOIN tbd_deportista d ON a.id_deportista = d.id
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_estado e ON a.id_estado = e.id
  WHERE a.id_entrenamiento = $1
  ORDER BY p.apellido
`, [id_entrenamiento])

const getAsistenciasByDeportista = (id_deportista) => pool.query(`
  SELECT a.*,
    en.fecha, en.hora_inicio, en.hora_fin,
    ca.nombre AS cancha,
    e.nombre AS estado
  FROM tbd_asistencia a
  LEFT JOIN tbd_entrenamiento en ON a.id_entrenamiento = en.id
  LEFT JOIN tbd_cancha ca ON en.id_cancha = ca.id
  LEFT JOIN tbd_estado e ON a.id_estado = e.id
  WHERE a.id_deportista = $1
  ORDER BY en.fecha DESC
`, [id_deportista])

const createAsistencia = (data) => pool.query(`
  INSERT INTO tbd_asistencia (id_deportista, id_entrenamiento, id_estado)
  VALUES ($1, $2, $3)
  RETURNING *
`, [data.id_deportista, data.id_entrenamiento, data.id_estado])

const updateAsistencia = (id, data) => pool.query(`
  UPDATE tbd_asistencia SET
    id_deportista = $1, id_entrenamiento = $2, id_estado = $3
  WHERE id = $4
  RETURNING *
`, [data.id_deportista, data.id_entrenamiento, data.id_estado, id])

const deleteAsistencia = (id) => pool.query(`
  UPDATE tbd_asistencia SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = {
  getAsistencias, getAsistenciaById, getAsistenciasByEntrenamiento,
  getAsistenciasByDeportista, createAsistencia, updateAsistencia, deleteAsistencia
}