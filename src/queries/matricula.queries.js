const pool = require('../db')

const getMatriculas = () => pool.query(`
  SELECT m.*,
    p.nombre, p.apellido, p.numero_documento,
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
    p.nombre, p.apellido, p.numero_documento,
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

// Marca una matrícula como pagada (idempotente: si ya estaba pagada, no la toca)
const marcarPagada = (id) => pool.query(`
  UPDATE tbd_matricula
  SET fecha_pago = NOW()
  WHERE id = $1 AND fecha_pago IS NULL
  RETURNING *
`, [id])

// Revierte el pago: vuelve fecha_pago a NULL. Solo aplica si estaba pagada.
const revertirPago = (id) => pool.query(`
  UPDATE tbd_matricula
  SET fecha_pago = NULL
  WHERE id = $1 AND fecha_pago IS NOT NULL
  RETURNING *
`, [id])

// Genera una matrícula del año para cada deportista activo que aún no tenga
// una matrícula en ese año. Idempotente: si ya la tiene, se omite.
// El valor se infiere del histórico de matrículas de la misma categoría;
// si no hay historial, se usa el valor_mensualidad del deportista; si tampoco,
// queda en 0 (el admin debe editarla).
const generarMatriculasDelAño = (año) => pool.query(`
  INSERT INTO tbd_matricula (id_deportista, fecha_inicio, valor, id_categoria, id_estado, fecha_pago)
  SELECT
    d.id,
    CURRENT_DATE,
    COALESCE(
      (SELECT m2.valor FROM tbd_matricula m2
       WHERE m2.id_categoria = d.id_categoria
       ORDER BY m2.fecha_inicio DESC LIMIT 1),
      d.valor_mensualidad,
      0
    )::NUMERIC,
    d.id_categoria,
    1,
    NULL
  FROM tbd_deportista d
  WHERE d.id_estado = 1
    AND d.id_categoria IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM tbd_matricula m
      WHERE m.id_deportista = d.id
        AND EXTRACT(YEAR FROM m.fecha_inicio) = $1
    )
  RETURNING *
`, [año])

// --- Marcado masivo del año -----------------------------------------------
// `ids` acota la acción al subconjunto que el administrador tiene filtrado en
// pantalla. Si viene null, aplica a todos los deportistas activos.
// El año no es una columna: se deriva de fecha_inicio.

// Valor de referencia de la matrícula: se toma del histórico de la categoría
// y, si no hay, del valor de mensualidad del deportista.
const VALOR_REFERENCIA = `
  COALESCE(
    (SELECT m2.valor FROM tbd_matricula m2
      WHERE m2.id_categoria = d.id_categoria AND m2.valor > 0
      ORDER BY m2.fecha_inicio DESC LIMIT 1),
    d.valor_mensualidad,
    0
  )::NUMERIC
`

// Cuántas del alcance ya estaban pagadas, para informar cuántas cambiaron.
const contarPagadasDelAnio = (anio, ids, runner = pool) => runner.query(`
  SELECT COUNT(*)::int AS pagadas
  FROM tbd_matricula m
  JOIN tbd_deportista d ON d.id = m.id_deportista
  WHERE EXTRACT(YEAR FROM m.fecha_inicio) = $1
    AND m.id_estado = 1
    AND m.fecha_pago IS NOT NULL
    AND d.id_estado = 1
    AND ($2::int[] IS NULL OR m.id_deportista = ANY($2))
`, [anio, ids])

// Paso 1: pagar las matrículas que ya existen y están pendientes.
const pagarExistentesDelAnio = (anio, ids, runner = pool) => runner.query(`
  UPDATE tbd_matricula m
  SET fecha_pago = NOW()
  FROM tbd_deportista d
  WHERE d.id = m.id_deportista
    AND EXTRACT(YEAR FROM m.fecha_inicio) = $1
    AND m.id_estado = 1
    AND m.fecha_pago IS NULL
    AND d.id_estado = 1
    AND ($2::int[] IS NULL OR m.id_deportista = ANY($2))
  RETURNING m.id
`, [anio, ids])

// Paso 2: crear y pagar las que faltan. Solo se crean si se puede inferir un
// valor mayor que cero; una matrícula en 0 no sirve para el recaudo.
const crearYPagarFaltantesDelAnio = (anio, ids, runner = pool) => runner.query(`
  INSERT INTO tbd_matricula (id_deportista, fecha_inicio, valor, id_categoria, id_estado, fecha_pago)
  SELECT d.id, MAKE_DATE($1, 1, 1), ${VALOR_REFERENCIA}, d.id_categoria, 1, NOW()
  FROM tbd_deportista d
  WHERE d.id_estado = 1
    AND d.id_categoria IS NOT NULL
    AND ${VALOR_REFERENCIA} > 0
    AND ($2::int[] IS NULL OR d.id = ANY($2))
    AND NOT EXISTS (
      SELECT 1 FROM tbd_matricula m
      WHERE m.id_deportista = d.id AND EXTRACT(YEAR FROM m.fecha_inicio) = $1
    )
  RETURNING id
`, [anio, ids])

// Deportistas del alcance que quedarían fuera por no poder inferir un valor.
const contarSinValorMatricula = (anio, ids, runner = pool) => runner.query(`
  SELECT COUNT(*)::int AS sin_valor
  FROM tbd_deportista d
  WHERE d.id_estado = 1
    AND ($2::int[] IS NULL OR d.id = ANY($2))
    AND (d.id_categoria IS NULL OR ${VALOR_REFERENCIA} <= 0)
    AND NOT EXISTS (
      SELECT 1 FROM tbd_matricula m
      WHERE m.id_deportista = d.id AND EXTRACT(YEAR FROM m.fecha_inicio) = $1
    )
`, [anio, ids])

// Quita el pago a todo el alcance. No borra: vuelve a pendiente.
const revertirAnioCompleto = (anio, ids, runner = pool) => runner.query(`
  UPDATE tbd_matricula m
  SET fecha_pago = NULL
  FROM tbd_deportista d
  WHERE d.id = m.id_deportista
    AND EXTRACT(YEAR FROM m.fecha_inicio) = $1
    AND m.id_estado = 1
    AND m.fecha_pago IS NOT NULL
    AND d.id_estado = 1
    AND ($2::int[] IS NULL OR m.id_deportista = ANY($2))
  RETURNING m.id
`, [anio, ids])

module.exports = {
  contarPagadasDelAnio,
  pagarExistentesDelAnio,
  crearYPagarFaltantesDelAnio,
  contarSinValorMatricula,
  revertirAnioCompleto,
  getMatriculas, getMatriculaById, getMatriculasByDeportista,
  createMatricula, updateMatricula, deleteMatricula,
  marcarPagada, revertirPago, generarMatriculasDelAño
}