const pool = require('../db')

const getPersonas = () => pool.query(`
  SELECT p.*, r.nombre_rol, g.nombre_genero, td.nombre AS tipo_documento, e.nombre AS estado
  FROM tbd_persona p
  LEFT JOIN tbd_rol r ON p.id_rol = r.id
  LEFT JOIN tbd_genero g ON p.id_genero = g.id
  LEFT JOIN tbd_tipo_documento td ON p.id_tipo_documento = td.id
  LEFT JOIN tbd_estado e ON p.id_estado = e.id
  ORDER BY p.id
`)

const getPersonaById = (id) => pool.query(`
  SELECT p.*, r.nombre_rol, g.nombre_genero, td.nombre AS tipo_documento, e.nombre AS estado
  FROM tbd_persona p
  LEFT JOIN tbd_rol r ON p.id_rol = r.id
  LEFT JOIN tbd_genero g ON p.id_genero = g.id
  LEFT JOIN tbd_tipo_documento td ON p.id_tipo_documento = td.id
  LEFT JOIN tbd_estado e ON p.id_estado = e.id
  WHERE p.id = $1
`, [id])

const createPersona = (data) => pool.query(`
  INSERT INTO tbd_persona 
    (nombre, apellido, fecha_nacimiento, correo, id_rol, numero_telefono, id_genero, id_tipo_documento, numero_documento, id_estado)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  RETURNING *
`, [
  data.nombre, data.apellido, data.fecha_nacimiento, data.correo,
  data.id_rol, data.numero_telefono, data.id_genero,
  data.id_tipo_documento, data.numero_documento, data.id_estado
])

const updatePersona = (id, data) => pool.query(`
  UPDATE tbd_persona SET
    nombre = $1, apellido = $2, fecha_nacimiento = $3, correo = $4,
    id_rol = $5, numero_telefono = $6, id_genero = $7,
    id_tipo_documento = $8, numero_documento = $9, id_estado = $10
  WHERE id = $11
  RETURNING *
`, [
  data.nombre, data.apellido, data.fecha_nacimiento, data.correo,
  data.id_rol, data.numero_telefono, data.id_genero,
  data.id_tipo_documento, data.numero_documento, data.id_estado, id
])

const deletePersona = (id) => pool.query(`
  UPDATE tbd_persona SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = { getPersonas, getPersonaById, createPersona, updatePersona, deletePersona }