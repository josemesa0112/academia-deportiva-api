const pool = require('../db')
// Profesores asignados, embebidos en el listado para no hacer N+1.
const PROFESORES = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', pr.id, 'nombre', p.nombre, 'apellido', p.apellido) ORDER BY pr.id)
     FROM tbd_entrenamiento_x_profesor exp
     JOIN tbd_profesor pr ON pr.id = exp.id_profesor
     LEFT JOIN tbd_persona p ON p.id = pr.id_persona
     WHERE exp.id_entrenamiento = en.id),
    '[]'::json
  ) AS profesores
`

const getEntrenamientos = () => pool.query(`
  SELECT en.*,
    ca.nombre AS cancha, ca.barrio, ca.direccion,
    cat.nombre AS categoria,
    e.nombre AS estado,
    ${PROFESORES}
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

const createEntrenamiento = (data, runner = pool) => runner.query(`
  INSERT INTO tbd_entrenamiento (id_cancha, id_categoria, hora_inicio, hora_fin, fecha, id_estado)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *
`, [data.id_cancha, data.id_categoria, data.hora_inicio, data.hora_fin, data.fecha, data.id_estado])

const updateEntrenamiento = (id, data, runner = pool) => runner.query(`
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

// Sincroniza los profesores de un entrenamiento: borra los que ya no
// estan e inserta los nuevos. Mismo patron que proveedor <-> productos.
const syncProfesores = async (client, id_entrenamiento, profesores) => {
  if (profesores.length === 0) {
    await client.query('DELETE FROM tbd_entrenamiento_x_profesor WHERE id_entrenamiento = $1', [id_entrenamiento])
    return
  }
  await client.query(
    `DELETE FROM tbd_entrenamiento_x_profesor
      WHERE id_entrenamiento = $1
        AND id_profesor <> ALL($2::int[])`,
    [id_entrenamiento, profesores]
  )
  for (const id_profesor of profesores) {
    await client.query(
      `INSERT INTO tbd_entrenamiento_x_profesor (id_entrenamiento, id_profesor)
       VALUES ($1, $2)
       ON CONFLICT (id_profesor, id_entrenamiento) DO NOTHING`,
      [id_entrenamiento, id_profesor]
    )
  }
}

module.exports = {
  syncProfesores,
  getEntrenamientos, getEntrenamientoById, createEntrenamiento,
  updateEntrenamiento, deleteEntrenamiento, getProfesoresByEntrenamiento,
  addProfesorToEntrenamiento, removeProfesorFromEntrenamiento
}