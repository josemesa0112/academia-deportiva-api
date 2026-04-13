const pool = require('../db')

const getProfesores = () => pool.query(`
  SELECT pr.*, 
    p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
    e.nombre AS estado
  FROM tbd_profesor pr
  LEFT JOIN tbd_persona p ON pr.id_persona = p.id
  LEFT JOIN tbd_estado e ON pr.id_estado = e.id
  ORDER BY pr.id
`)

const getProfesorById = (id) => pool.query(`
  SELECT pr.*, 
    p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
    e.nombre AS estado
  FROM tbd_profesor pr
  LEFT JOIN tbd_persona p ON pr.id_persona = p.id
  LEFT JOIN tbd_estado e ON pr.id_estado = e.id
  WHERE pr.id = $1
`, [id])

const createProfesor = (data) => pool.query(`
  INSERT INTO tbd_profesor (id_persona, salario, id_estado)
  VALUES ($1, $2, $3)
  RETURNING *
`, [data.id_persona, data.salario, data.id_estado])

const updateProfesor = (id, data) => pool.query(`
  UPDATE tbd_profesor SET
    id_persona = $1, salario = $2, id_estado = $3
  WHERE id = $4
  RETURNING *
`, [data.id_persona, data.salario, data.id_estado, id])

const deleteProfesor = (id) => pool.query(`
  UPDATE tbd_profesor SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = { getProfesores, getProfesorById, createProfesor, updateProfesor, deleteProfesor }