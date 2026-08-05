const pool = require('../db')

// Solo gastos activos por defecto: los anulados (id_estado = 2) se conservan
// para auditoría pero no deben sumar ni aparecer en el listado.
const getGastos = () => pool.query(`
  SELECT g.*,
    tg.nombre AS tipo_gasto,
    e.nombre AS estado
  FROM tbd_gasto g
  LEFT JOIN tbd_tipo_gasto tg ON g.id_tipo_gasto = tg.id
  LEFT JOIN tbd_estado e ON g.id_estado = e.id
  WHERE g.id_estado = 1
  ORDER BY g.fecha DESC, g.id DESC
`)

const getGastoById = (id) => pool.query(`
  SELECT g.*,
    tg.nombre AS tipo_gasto,
    e.nombre AS estado
  FROM tbd_gasto g
  LEFT JOIN tbd_tipo_gasto tg ON g.id_tipo_gasto = tg.id
  LEFT JOIN tbd_estado e ON g.id_estado = e.id
  WHERE g.id = $1
`, [id])

const createGasto = (data) => pool.query(`
  INSERT INTO tbd_gasto (concepto, id_tipo_gasto, valor, fecha, descripcion, id_estado)
  VALUES ($1, $2, $3, $4, $5, COALESCE($6, 1))
  RETURNING *
`, [data.concepto, data.id_tipo_gasto, data.valor, data.fecha, data.descripcion || null, data.id_estado])

const updateGasto = (id, data) => pool.query(`
  UPDATE tbd_gasto SET
    concepto = $1, id_tipo_gasto = $2, valor = $3,
    fecha = $4, descripcion = $5, id_estado = COALESCE($6, id_estado)
  WHERE id = $7
  RETURNING *
`, [data.concepto, data.id_tipo_gasto, data.valor, data.fecha, data.descripcion || null, data.id_estado, id])

// Soft delete: se anula, no se borra, para no alterar cierres anteriores.
const anularGasto = (id) => pool.query(`
  UPDATE tbd_gasto SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

// Totales del mes, usados por el dashboard.
const getTotalMes = (mes, año) => pool.query(`
  SELECT
    COALESCE(SUM(valor), 0)::DECIMAL AS total,
    COUNT(*)::INT AS cantidad
  FROM tbd_gasto
  WHERE id_estado = 1
    AND EXTRACT(MONTH FROM fecha) = $1
    AND EXTRACT(YEAR FROM fecha) = $2
`, [mes, año])

// Desglose por tipo, para saber en qué se va la plata del mes.
const getPorTipoMes = (mes, año) => pool.query(`
  SELECT tg.nombre AS tipo, COALESCE(SUM(g.valor), 0)::DECIMAL AS total
  FROM tbd_gasto g
  JOIN tbd_tipo_gasto tg ON tg.id = g.id_tipo_gasto
  WHERE g.id_estado = 1
    AND EXTRACT(MONTH FROM g.fecha) = $1
    AND EXTRACT(YEAR FROM g.fecha) = $2
  GROUP BY tg.nombre
  ORDER BY total DESC
`, [mes, año])

module.exports = {
  getGastos,
  getGastoById,
  createGasto,
  updateGasto,
  anularGasto,
  getTotalMes,
  getPorTipoMes,
}