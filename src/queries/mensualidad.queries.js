const pool = require('../db')

// Por defecto solo trae las mensualidades del mes/año pasados como parámetros
// (típicamente el mes actual). El historial completo por deportista se consulta
// vía /api/mensualidades/deportista/:id desde el perfil.
const getMensualidades = (mes, año) => pool.query(`
  SELECT mn.*,
    p.nombre, p.apellido, p.numero_documento,
    cat.nombre AS categoria,
    e.nombre AS estado
  FROM tbd_mensualidad mn
  LEFT JOIN tbd_deportista d ON mn.id_deportista = d.id
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_categoria cat ON d.id_categoria = cat.id
  LEFT JOIN tbd_estado e ON mn.id_estado = e.id
  WHERE mn.mes = $1 AND mn.año = $2
  ORDER BY p.apellido, p.nombre
`, [mes, año])

const getMensualidadById = (id) => pool.query(`
  SELECT mn.*,
    p.nombre, p.apellido, p.numero_documento,
    cat.nombre AS categoria,
    e.nombre AS estado
  FROM tbd_mensualidad mn
  LEFT JOIN tbd_deportista d ON mn.id_deportista = d.id
  LEFT JOIN tbd_persona p ON d.id_persona = p.id
  LEFT JOIN tbd_categoria cat ON d.id_categoria = cat.id
  LEFT JOIN tbd_estado e ON mn.id_estado = e.id
  WHERE mn.id = $1
`, [id])

const getMensualidadesByDeportista = (id_deportista) => pool.query(`
  SELECT mn.*, e.nombre AS estado
  FROM tbd_mensualidad mn
  LEFT JOIN tbd_estado e ON mn.id_estado = e.id
  WHERE mn.id_deportista = $1
  ORDER BY mn.año DESC, mn.mes DESC
`, [id_deportista])

const createMensualidad = (data) => pool.query(`
  INSERT INTO tbd_mensualidad (id_deportista, mes, año, valor, id_estado)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *
`, [data.id_deportista, data.mes, data.año, data.valor, data.id_estado])

const updateMensualidad = (id, data) => pool.query(`
  UPDATE tbd_mensualidad SET
    id_deportista = $1, mes = $2, año = $3,
    valor = $4, id_estado = $5
  WHERE id = $6
  RETURNING *
`, [data.id_deportista, data.mes, data.año, data.valor, data.id_estado, id])

const deleteMensualidad = (id) => pool.query(`
  UPDATE tbd_mensualidad SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

// Marca una mensualidad como pagada (idempotente: si ya estaba pagada, no la toca)
const marcarPagada = (id) => pool.query(`
  UPDATE tbd_mensualidad
  SET fecha_pago = NOW()
  WHERE id = $1 AND fecha_pago IS NULL
  RETURNING *
`, [id])

// Revierte el pago: vuelve fecha_pago a NULL. Solo aplica si estaba pagada.
const revertirPago = (id) => pool.query(`
  UPDATE tbd_mensualidad
  SET fecha_pago = NULL
  WHERE id = $1 AND fecha_pago IS NOT NULL
  RETURNING *
`, [id])

// Genera mensualidades del mes indicado para todos los deportistas activos con valor_mensualidad.
// Idempotente gracias al UNIQUE INDEX (id_deportista, mes, año): los duplicados se ignoran.
const generarMensualidadesDelMes = (mes, año) => pool.query(`
  INSERT INTO tbd_mensualidad (id_deportista, mes, año, valor, id_estado, fecha_pago)
  SELECT d.id, $1, $2, d.valor_mensualidad, 1, NULL
  FROM tbd_deportista d
  WHERE d.id_estado = 1
    AND d.valor_mensualidad IS NOT NULL
    AND d.valor_mensualidad > 0
  ON CONFLICT (id_deportista, mes, año) DO NOTHING
  RETURNING *
`, [mes, año])

// Matriz anual: una fila por deportista activo con sus 12 meses.
// Se resuelve en una sola consulta con json_agg para no hacer N+1.
// Las mensualidades anuladas (id_estado = 2) se ignoran: cuentan como
// inexistentes, y volver a marcarlas como pagadas las reactiva.
const getMatrizAnual = (año) => pool.query(`
  SELECT
    d.id AS id_deportista,
    p.nombre, p.apellido, p.numero_documento,
    d.id_categoria,
    cat.nombre AS categoria,
    d.valor_mensualidad,
    COALESCE(
      json_agg(
        json_build_object(
          'id', mn.id,
          'mes', mn.mes,
          'valor', mn.valor,
          'fecha_pago', mn.fecha_pago
        ) ORDER BY mn.mes
      ) FILTER (WHERE mn.id IS NOT NULL),
      '[]'::json
    ) AS meses
  FROM tbd_deportista d
  JOIN tbd_persona p ON p.id = d.id_persona
  LEFT JOIN tbd_categoria cat ON cat.id = d.id_categoria
  LEFT JOIN tbd_mensualidad mn
         ON mn.id_deportista = d.id AND mn.año = $1 AND mn.id_estado = 1
  WHERE d.id_estado = 1
  GROUP BY d.id, p.nombre, p.apellido, p.numero_documento,
           d.id_categoria, cat.nombre, d.valor_mensualidad
  ORDER BY p.apellido, p.nombre
`, [año])

// Datos del deportista necesarios para crear una mensualidad al vuelo.
const getDeportistaParaMensualidad = (id) => pool.query(`
  SELECT d.id, d.valor_mensualidad, d.id_estado,
         p.nombre, p.apellido
  FROM tbd_deportista d
  JOIN tbd_persona p ON p.id = d.id_persona
  WHERE d.id = $1
`, [id])

// ¿Existe ya la mensualidad de ese periodo? (incluye las anuladas)
const getMensualidadDePeriodo = (id_deportista, mes, año) => pool.query(`
  SELECT id, valor, fecha_pago, id_estado
  FROM tbd_mensualidad
  WHERE id_deportista = $1 AND mes = $2 AND año = $3
`, [id_deportista, mes, año])

// Marca pagado creando la fila si hace falta. Esto es lo que permite
// registrar meses por adelantado, que aún no han sido generados.
// El UNIQUE (id_deportista, mes, año) hace la operación segura ante
// clics simultáneos: el segundo cae en el DO UPDATE.
const marcarPagoDePeriodo = (id_deportista, mes, año, valor) => pool.query(`
  INSERT INTO tbd_mensualidad (id_deportista, mes, año, valor, id_estado, fecha_pago)
  VALUES ($1, $2, $3, $4, 1, NOW())
  ON CONFLICT (id_deportista, mes, año)
  DO UPDATE SET fecha_pago = NOW(), id_estado = 1
  RETURNING *
`, [id_deportista, mes, año, valor])

// Quita el pago de un periodo. Si la fila no existe no hay nada que revertir.
const revertirPagoDePeriodo = (id_deportista, mes, año) => pool.query(`
  UPDATE tbd_mensualidad
  SET fecha_pago = NULL
  WHERE id_deportista = $1 AND mes = $2 AND año = $3
  RETURNING *
`, [id_deportista, mes, año])

// --- Marcado masivo de un mes -------------------------------------------
// `ids` acotan la operación a un subconjunto (lo que el admin tiene filtrado
// en pantalla). Si viene null, aplica a todos los deportistas activos.

// Cuántos del alcance ya están pagados. Sirve para informar cuántos cambiaron
// de verdad, sin confundir "ya estaba pagado" con "lo acabo de pagar".
const contarPagadasDelMes = (mes, año, ids, runner = pool) => runner.query(`
  SELECT COUNT(*)::int AS pagadas
  FROM tbd_mensualidad mn
  JOIN tbd_deportista d ON d.id = mn.id_deportista
  WHERE mn.mes = $1 AND mn.año = $2 AND mn.id_estado = 1
    AND mn.fecha_pago IS NOT NULL
    AND d.id_estado = 1
    AND ($3::int[] IS NULL OR mn.id_deportista = ANY($3))
`, [mes, año, ids])

// Paso 1: marcar las mensualidades que ya existen, sin pisar la fecha de
// las que ya estaban pagadas.
const pagarExistentesDelMes = (mes, año, ids, runner = pool) => runner.query(`
  UPDATE tbd_mensualidad mn
  SET fecha_pago = NOW(), id_estado = 1
  FROM tbd_deportista d
  WHERE d.id = mn.id_deportista
    AND mn.mes = $1 AND mn.año = $2
    AND mn.fecha_pago IS NULL
    AND d.id_estado = 1
    AND ($3::int[] IS NULL OR mn.id_deportista = ANY($3))
  RETURNING mn.id
`, [mes, año, ids])

// Paso 2: crear y pagar las que faltan. Solo aplica a deportistas con valor
// de mensualidad definido: sin él no se puede crear una fila coherente.
const crearYPagarFaltantesDelMes = (mes, año, ids, runner = pool) => runner.query(`
  INSERT INTO tbd_mensualidad (id_deportista, mes, año, valor, id_estado, fecha_pago)
  SELECT d.id, $1, $2, d.valor_mensualidad, 1, NOW()
  FROM tbd_deportista d
  WHERE d.id_estado = 1
    AND d.valor_mensualidad IS NOT NULL
    AND d.valor_mensualidad > 0
    AND ($3::int[] IS NULL OR d.id = ANY($3))
  ON CONFLICT (id_deportista, mes, año) DO NOTHING
  RETURNING id
`, [mes, año, ids])

// Deportistas del alcance que quedaron fuera por no tener valor definido.
const contarSinValorMensualidad = (ids, runner = pool) => runner.query(`
  SELECT COUNT(*)::int AS sin_valor
  FROM tbd_deportista d
  WHERE d.id_estado = 1
    AND (d.valor_mensualidad IS NULL OR d.valor_mensualidad <= 0)
    AND ($1::int[] IS NULL OR d.id = ANY($1))
`, [ids])

// Quita el pago a todo el alcance. No borra filas: solo vuelve a pendiente.
const revertirMesCompleto = (mes, año, ids, runner = pool) => runner.query(`
  UPDATE tbd_mensualidad mn
  SET fecha_pago = NULL
  FROM tbd_deportista d
  WHERE d.id = mn.id_deportista
    AND mn.mes = $1 AND mn.año = $2
    AND mn.fecha_pago IS NOT NULL
    AND d.id_estado = 1
    AND ($3::int[] IS NULL OR mn.id_deportista = ANY($3))
  RETURNING mn.id
`, [mes, año, ids])

module.exports = {
  contarPagadasDelMes,
  pagarExistentesDelMes,
  crearYPagarFaltantesDelMes,
  contarSinValorMensualidad,
  revertirMesCompleto,
  getMatrizAnual,
  getDeportistaParaMensualidad,
  getMensualidadDePeriodo,
  marcarPagoDePeriodo,
  revertirPagoDePeriodo,
  getMensualidades,
  getMensualidadById,
  getMensualidadesByDeportista,
  createMensualidad,
  updateMensualidad,
  deleteMensualidad,
  marcarPagada,
  revertirPago,
  generarMensualidadesDelMes,
}
