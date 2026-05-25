const pool = require('../db')

const getDeportistas = () => pool.query(`
  SELECT d.*,
    p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
    c.nombre AS categoria, cl.nombre AS clasificacion,
    e.nombre AS estado
  FROM tbd_deportista d
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_categoria c ON d.id_categoria = c.id
  LEFT JOIN tbd_clasificacion cl ON d.id_clasificacion = cl.id
  LEFT JOIN tbd_estado e ON d.id_estado = e.id
  ORDER BY d.id
`)

const getDeportistaById = (id) => pool.query(`
  SELECT d.*,
    p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
    p.fecha_nacimiento,
    c.nombre AS categoria, cl.nombre AS clasificacion,
    e.nombre AS estado,
    COALESCE(
      (SELECT json_agg(json_build_object('id', pos.id, 'nombre', pos.nombre) ORDER BY pos.id)
       FROM tbd_deportista_x_posicion dxp
       JOIN tbd_posicion pos ON pos.id = dxp.id_posicion
       WHERE dxp.id_deportista = d.id),
      '[]'::json
    ) AS posiciones
  FROM tbd_deportista d
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_categoria c ON d.id_categoria = c.id
  LEFT JOIN tbd_clasificacion cl ON d.id_clasificacion = cl.id
  LEFT JOIN tbd_estado e ON d.id_estado = e.id
  WHERE d.id = $1
`, [id])

// runner permite ejecutar dentro de una transacción (recibe el client de pool.connect())
const createDeportistaRow = (data, runner = pool) => runner.query(`
  INSERT INTO tbd_deportista
    (id_persona, peso_actual, valor_mensualidad, estatura_actual, IMC_actual, porcentaje_grasa_actual, id_clasificacion, id_categoria, id_estado)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING *
`, [
  data.id_persona, data.peso_actual, data.valor_mensualidad,
  data.estatura_actual, data.IMC_actual, data.porcentaje_grasa_actual,
  data.id_clasificacion, data.id_categoria, data.id_estado
])

const updateDeportistaRow = (id, data, runner = pool) => runner.query(`
  UPDATE tbd_deportista SET
    id_persona = $1, peso_actual = $2, valor_mensualidad = $3,
    estatura_actual = $4, IMC_actual = $5, porcentaje_grasa_actual = $6,
    id_clasificacion = $7, id_categoria = $8, id_estado = $9
  WHERE id = $10
  RETURNING *
`, [
  data.id_persona, data.peso_actual, data.valor_mensualidad,
  data.estatura_actual, data.IMC_actual, data.porcentaje_grasa_actual,
  data.id_clasificacion, data.id_categoria, data.id_estado, id
])

const getDeportistaSnapshot = (id, runner = pool) => runner.query(`
  SELECT peso_actual, estatura_actual, IMC_actual, porcentaje_grasa_actual
  FROM tbd_deportista WHERE id = $1
`, [id])

const deleteDeportista = (id) => pool.query(`
  UPDATE tbd_deportista SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

const getDeportistasByCategoria = (id_categoria) => pool.query(`
  SELECT d.*,
    p.nombre, p.apellido, p.numero_documento,
    c.nombre AS categoria,
    e.nombre AS estado
  FROM tbd_deportista d
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_categoria c ON d.id_categoria = c.id
  LEFT JOIN tbd_estado e ON d.id_estado = e.id
  WHERE d.id_categoria = $1 AND d.id_estado = 1
  ORDER BY p.apellido
`, [id_categoria])

module.exports = {
  getDeportistas,
  getDeportistaById,
  createDeportistaRow,
  updateDeportistaRow,
  getDeportistaSnapshot,
  deleteDeportista,
  getDeportistasByCategoria,
}
