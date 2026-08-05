const pool = require('../db')

// Recaudo del mes (mensualidades pagadas en el periodo + matrículas pagadas en el periodo)
const getRecaudoMes = (mes, año) => pool.query(`
  SELECT
    COALESCE((
      SELECT SUM(valor) FROM tbd_mensualidad
      WHERE mes = $1 AND año = $2 AND fecha_pago IS NOT NULL
    ), 0)::DECIMAL AS recaudo_mensualidades,
    COALESCE((
      SELECT SUM(valor) FROM tbd_matricula
      WHERE fecha_pago IS NOT NULL
        AND EXTRACT(MONTH FROM fecha_pago) = $1
        AND EXTRACT(YEAR FROM fecha_pago) = $2
    ), 0)::DECIMAL AS recaudo_matriculas
`, [mes, año])

// Pendiente por cobrar del mes (mensualidades del mes sin pagar)
const getPendienteMes = (mes, año) => pool.query(`
  SELECT
    COALESCE(SUM(valor), 0)::DECIMAL AS pendiente,
    COUNT(*)::INT AS cantidad_pendientes
  FROM tbd_mensualidad
  WHERE mes = $1 AND año = $2 AND fecha_pago IS NULL
`, [mes, año])

// Matrículas pendientes (TODAS sin pagar, sin filtro de mes — una
// matrícula vieja sin pagar sigue siendo dinero por cobrar).
const getMatriculasPendientesTotal = () => pool.query(`
  SELECT
    COALESCE(SUM(valor), 0)::DECIMAL AS pendiente,
    COUNT(*)::INT AS cantidad_pendientes
  FROM tbd_matricula
  WHERE fecha_pago IS NULL
`)

// Compras a proveedores del periodo. Es solo una parte del egreso: el resto
// (arriendo, servicios, nómina...) vive en tbd_gasto.
const getComprasMes = (mes, año) => pool.query(`
  SELECT
    COALESCE(SUM(total_compra), 0)::DECIMAL AS total,
    COUNT(*)::INT AS cantidad_compras
  FROM tbd_compra
  WHERE EXTRACT(MONTH FROM fecha_compra) = $1
    AND EXTRACT(YEAR FROM fecha_compra) = $2
`, [mes, año])

// Recaudación de los últimos 6 meses (para gráfica de barras).
// Usamos multiplicación de INTERVAL para evitar concatenar int+text
// (que falla en algunas versiones de PostgreSQL).
const getRecaudacionHistorica = () => pool.query(`
  WITH meses AS (
    SELECT
      (date_trunc('month', CURRENT_DATE) - (INTERVAL '1 month' * n))::DATE AS fecha_mes
    FROM generate_series(0, 5) AS n
  ),
  meses_expandidos AS (
    SELECT
      TO_CHAR(fecha_mes, 'YYYY-MM') AS periodo,
      EXTRACT(MONTH FROM fecha_mes)::INT AS mes,
      EXTRACT(YEAR FROM fecha_mes)::INT AS año
    FROM meses
  )
  SELECT
    m.periodo,
    m.mes,
    m.año,
    COALESCE((
      SELECT SUM(valor) FROM tbd_mensualidad mn
      WHERE mn.mes = m.mes AND mn.año = m.año AND mn.fecha_pago IS NOT NULL
    ), 0)::DECIMAL AS recaudo_mensualidades,
    COALESCE((
      SELECT SUM(valor) FROM tbd_matricula mt
      WHERE mt.fecha_pago IS NOT NULL
        AND EXTRACT(MONTH FROM mt.fecha_pago) = m.mes
        AND EXTRACT(YEAR FROM mt.fecha_pago) = m.año
    ), 0)::DECIMAL AS recaudo_matriculas
  FROM meses_expandidos m
  ORDER BY m.año, m.mes
`)

// Distribución de deportistas por categoría
const getDeportistasPorCategoria = () => pool.query(`
  SELECT c.id, c.nombre AS categoria, COUNT(d.id)::INT AS total
  FROM tbd_categoria c
  LEFT JOIN tbd_deportista d ON d.id_categoria = c.id AND d.id_estado = 1
  WHERE LOWER(TRIM(c.nombre)) LIKE 'sub %'
  GROUP BY c.id, c.nombre
  ORDER BY c.id
`)

// Conteos rápidos
const getConteos = () => pool.query(`
  SELECT
    (SELECT COUNT(*) FROM tbd_deportista WHERE id_estado = 1)::INT AS deportistas,
    (SELECT COUNT(*) FROM tbd_profesor WHERE id_estado = 1)::INT AS profesores,
    (SELECT COUNT(*) FROM tbd_proveedores WHERE id_estado = 1)::INT AS proveedores
`)

// Asistencia promedio últimas 4 semanas
const getAsistenciaPromedio = () => pool.query(`
  SELECT
    COUNT(*) FILTER (WHERE a.id_estado = 1)::INT AS presentes,
    COUNT(*)::INT AS total
  FROM tbd_asistencia a
  JOIN tbd_entrenamiento e ON a.id_entrenamiento = e.id
  WHERE e.fecha >= CURRENT_DATE - INTERVAL '28 days'
    AND e.fecha <= CURRENT_DATE
`)

// Cumpleaños del mes (personas activas cumpliendo en el mes pedido)
const getCumpleanosDelMes = (mes) => pool.query(`
  SELECT p.id, p.nombre, p.apellido, p.fecha_nacimiento,
    EXTRACT(DAY FROM p.fecha_nacimiento)::INT AS dia,
    DATE_PART('year', AGE(p.fecha_nacimiento))::INT AS edad_actual,
    r.nombre_rol,
    c.nombre AS categoria
  FROM tbd_persona p
  LEFT JOIN tbd_rol r ON p.id_rol = r.id
  LEFT JOIN tbd_deportista d ON d.id_persona = p.id
  LEFT JOIN tbd_categoria c ON d.id_categoria = c.id
  WHERE p.fecha_nacimiento IS NOT NULL
    AND EXTRACT(MONTH FROM p.fecha_nacimiento) = $1
    AND p.id_estado = 1
    AND p.es_empresa = FALSE
  ORDER BY EXTRACT(DAY FROM p.fecha_nacimiento)
`, [mes])

// Próximos entrenamientos en los siguientes 7 días
const getProximosEntrenamientos = () => pool.query(`
  SELECT e.id, e.fecha, e.hora_inicio, e.hora_fin,
    c.nombre AS cancha,
    cat.nombre AS categoria
  FROM tbd_entrenamiento e
  LEFT JOIN tbd_cancha c ON e.id_cancha = c.id
  LEFT JOIN tbd_categoria cat ON e.id_categoria = cat.id
  WHERE e.fecha >= CURRENT_DATE
    AND e.fecha <= CURRENT_DATE + INTERVAL '7 days'
    AND e.id_estado = 1
  ORDER BY e.fecha, e.hora_inicio
  LIMIT 10
`)

module.exports = {
  getRecaudoMes,
  getPendienteMes,
  getMatriculasPendientesTotal,
  getComprasMes,
  getRecaudacionHistorica,
  getDeportistasPorCategoria,
  getConteos,
  getAsistenciaPromedio,
  getCumpleanosDelMes,
  getProximosEntrenamientos,
}
