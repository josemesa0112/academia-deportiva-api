const pool = require('../db')

// Conteo de sesiones de un profesor. Una sesión cuenta si el entrenamiento
// está activo (id_estado = 1, no anulado). Se separan las ya dictadas
// (fecha <= hoy) de las programadas: el pago solo se calcula sobre las
// dictadas, porque una sesión agendada para el mes entrante todavía no se
// le debe a nadie.
const SESIONES = `
  (SELECT COUNT(*)::int
     FROM tbd_entrenamiento_x_profesor exp
     JOIN tbd_entrenamiento en ON en.id = exp.id_entrenamiento
    WHERE exp.id_profesor = pr.id
      AND en.id_estado = 1
      AND en.fecha <= CURRENT_DATE) AS sesiones_dictadas,
  (SELECT COUNT(*)::int
     FROM tbd_entrenamiento_x_profesor exp
     JOIN tbd_entrenamiento en ON en.id = exp.id_entrenamiento
    WHERE exp.id_profesor = pr.id
      AND en.id_estado = 1
      AND en.fecha <= CURRENT_DATE
      AND EXTRACT(MONTH FROM en.fecha) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR  FROM en.fecha) = EXTRACT(YEAR  FROM CURRENT_DATE)) AS sesiones_mes,
  (SELECT COUNT(*)::int
     FROM tbd_entrenamiento_x_profesor exp
     JOIN tbd_entrenamiento en ON en.id = exp.id_entrenamiento
    WHERE exp.id_profesor = pr.id
      AND en.id_estado = 1
      AND en.fecha > CURRENT_DATE) AS sesiones_programadas
`

const CATEGORIAS = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', cat.id, 'nombre', cat.nombre) ORDER BY cat.id)
     FROM tbd_profesor_x_categoria pxc
     JOIN tbd_categoria cat ON cat.id = pxc.id_categoria
     WHERE pxc.id_profesor = pr.id),
    '[]'::json
  ) AS categorias
`

// El pago se devuelve ya calculado para que el cliente no repita la fórmula
// (y no se desincronice si cambia).
const PAGOS = `
  (t.sesiones_mes * t.valor_sesion)::numeric      AS pago_mes,
  (t.sesiones_dictadas * t.valor_sesion)::numeric AS pago_acumulado
`

const getProfesores = () => pool.query(`
  SELECT t.*, ${PAGOS}
  FROM (
    SELECT pr.*,
      p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
      e.nombre AS estado,
      ${CATEGORIAS},
      ${SESIONES}
    FROM tbd_profesor pr
    LEFT JOIN tbd_persona p ON pr.id_persona = p.id
    LEFT JOIN tbd_estado e ON pr.id_estado = e.id
  ) t
  ORDER BY t.id
`)

const getProfesorById = (id) => pool.query(`
  SELECT t.*, ${PAGOS}
  FROM (
    SELECT pr.*,
      p.nombre, p.apellido, p.correo, p.numero_telefono, p.numero_documento,
      e.nombre AS estado,
      ${CATEGORIAS},
      ${SESIONES}
    FROM tbd_profesor pr
    LEFT JOIN tbd_persona p ON pr.id_persona = p.id
    LEFT JOIN tbd_estado e ON pr.id_estado = e.id
    WHERE pr.id = $1
  ) t
`, [id])

// Detalle mes a mes de un año, para el perfil del profesor.
const getSesionesPorMes = (id_profesor, año) => pool.query(`
  SELECT
    EXTRACT(MONTH FROM en.fecha)::int AS mes,
    COUNT(*) FILTER (WHERE en.fecha <= CURRENT_DATE)::int AS dictadas,
    COUNT(*) FILTER (WHERE en.fecha >  CURRENT_DATE)::int AS programadas
  FROM tbd_entrenamiento_x_profesor exp
  JOIN tbd_entrenamiento en ON en.id = exp.id_entrenamiento
  WHERE exp.id_profesor = $1
    AND en.id_estado = 1
    AND EXTRACT(YEAR FROM en.fecha) = $2
  GROUP BY 1
  ORDER BY 1
`, [id_profesor, año])

// Sesiones individuales de un profesor, las más recientes primero.
const getSesionesDeProfesor = (id_profesor, limite = 50) => pool.query(`
  SELECT en.id, en.fecha, en.hora_inicio, en.hora_fin,
    ca.nombre AS cancha,
    cat.nombre AS categoria,
    (en.fecha > CURRENT_DATE) AS programada
  FROM tbd_entrenamiento_x_profesor exp
  JOIN tbd_entrenamiento en ON en.id = exp.id_entrenamiento
  LEFT JOIN tbd_cancha ca ON ca.id = en.id_cancha
  LEFT JOIN tbd_categoria cat ON cat.id = en.id_categoria
  WHERE exp.id_profesor = $1 AND en.id_estado = 1
  ORDER BY en.fecha DESC, en.hora_inicio DESC
  LIMIT $2
`, [id_profesor, limite])

const getCategoriasByProfesor = (id_profesor) => pool.query(`
  SELECT cat.id, cat.nombre
  FROM tbd_profesor_x_categoria pxc
  JOIN tbd_categoria cat ON cat.id = pxc.id_categoria
  WHERE pxc.id_profesor = $1
  ORDER BY cat.id
`, [id_profesor])

// No existe salario fijo: el pago sale de valor_sesion por las sesiones
// dictadas. valor_sesion cae a 40 si no se indica.
const createProfesorRow = (data, runner = pool) => runner.query(`
  INSERT INTO tbd_profesor (id_persona, valor_sesion, id_estado)
  VALUES ($1, COALESCE($2, 40), $3)
  RETURNING *
`, [data.id_persona, data.valor_sesion ?? null, data.id_estado])

const updateProfesorRow = (id, data, runner = pool) => runner.query(`
  UPDATE tbd_profesor SET
    id_persona = $1,
    -- COALESCE para no pisar la tarifa en updates parciales.
    valor_sesion = COALESCE($2, valor_sesion),
    id_estado = $3
  WHERE id = $4
  RETURNING *
`, [data.id_persona, data.valor_sesion ?? null, data.id_estado, id])

const deleteProfesor = (id) => pool.query(`
  UPDATE tbd_profesor SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

module.exports = {
  getProfesores,
  getProfesorById,
  getSesionesPorMes,
  getSesionesDeProfesor,
  getCategoriasByProfesor,
  createProfesorRow,
  updateProfesorRow,
  deleteProfesor,
}
