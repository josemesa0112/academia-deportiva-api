const pool = require('../db')

const getMatriculas = () => pool.query(`
  SELECT m.*,
    p.nombre, p.apellido,
    cat.nombre AS categoria,
    e.nombre AS estado
  FROM tbd_matricula m
  LEFT JOIN tbd_deportista d ON m.id_deportista = d.id
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_categoria cat ON m.id_categoria = cat.id
  LEFT JOIN tbd_estado e ON m.id_estado = e.id
  ORDER BY m.id
`)

const getMatriculaById = (id) => pool.query(`
  SELECT m.*,
    p.nombre, p.apellido,
    cat.nombre AS categoria,
    e.nombre AS estado
  FROM tbd_matricula m
  LEFT JOIN tbd_deportista d ON m.id_deportista = d.id
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_categoria cat ON m.id_categoria = cat.id
  LEFT JOIN tbd_estado e ON m.id_estado = e.id
  WHERE m.id = $1
`, [id])

const getMatriculasByDeportista = (id_deportista) => pool.query(`
  SELECT m.*,
    cat.nombre AS categoria,
    e.nombre AS estado
  FROM tbd_matricula m
  LEFT JOIN tbd_categoria cat ON m.id_categoria = cat.id
  LEFT JOIN tbd_estado e ON m.id_estado = e.id
  WHERE m.id_deportista = $1
  ORDER BY m.fecha_inicio DESC
`, [id_deportista])

const createMatricula = (data) => pool.query(`
  INSERT INTO tbd_matricula (id_deportista, fecha_inicio, valor, id_categoria, id_estado)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *
`, [data.id_deportista, data.fecha_inicio, data.valor, data.id_categoria, data.id_estado])

const updateMatricula = (id, data) => pool.query(`
  UPDATE tbd_matricula SET
    id_deportista = $1, fecha_inicio = $2, valor = $3,
    id_categoria = $4, id_estado = $5
  WHERE id = $6
  RETURNING *
`, [data.id_deportista, data.fecha_inicio, data.valor, data.id_categoria, data.id_estado, id])

const deleteMatricula = (id) => pool.query(`
  UPDATE tbd_matricula SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = {
  getMatriculas, getMatriculaById, getMatriculasByDeportista,
  createMatricula, updateMatricula, deleteMatricula
}