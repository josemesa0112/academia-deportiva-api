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

// Pendiente por cobrar del mes (mensualidades del mes sin pagar).
//
// La deuda de un deportista inactivo NO entra en la cartera: no se sabe si
// se va a cobrar, y arrastrarla mes a mes infla la cifra de forma
// permanente. El registro se conserva y se sigue viendo en Mensualidades;
// si el deportista se reactiva, vuelve a contar solo (el filtro es sobre
// el estado actual). Se devuelve aparte para no perderla de vista.
const getPendienteMes = (mes, año) => pool.query(`
  SELECT
    COALESCE(SUM(mn.valor) FILTER (WHERE d.id_estado = 1), 0)::DECIMAL AS pendiente,
    COUNT(*) FILTER (WHERE d.id_estado = 1)::INT AS cantidad_pendientes,
    COALESCE(SUM(mn.valor) FILTER (WHERE d.id_estado <> 1), 0)::DECIMAL AS pendiente_inactivos,
    COUNT(*) FILTER (WHERE d.id_estado <> 1)::INT AS cantidad_inactivos
  FROM tbd_mensualidad mn
  JOIN tbd_deportista d ON d.id = mn.id_deportista
  WHERE mn.mes = $1 AND mn.año = $2
    AND mn.fecha_pago IS NULL
    AND mn.id_estado = 1
`, [mes, año])

// Matrículas pendientes (TODAS sin pagar, sin filtro de mes — una
// matrícula vieja sin pagar sigue siendo dinero por cobrar).
// Mismo criterio que las mensualidades: las de deportistas inactivos se
// separan para no inflar la cartera.
const getMatriculasPendientesTotal = () => pool.query(`
  SELECT
    COALESCE(SUM(mt.valor) FILTER (WHERE d.id_estado = 1), 0)::DECIMAL AS pendiente,
    COUNT(*) FILTER (WHERE d.id_estado = 1)::INT AS cantidad_pendientes,
    COALESCE(SUM(mt.valor) FILTER (WHERE d.id_estado <> 1), 0)::DECIMAL AS pendiente_inactivos,
    COUNT(*) FILTER (WHERE d.id_estado <> 1)::INT AS cantidad_inactivos
  FROM tbd_matricula mt
  JOIN tbd_deportista d ON d.id = mt.id_deportista
  WHERE mt.fecha_pago IS NULL
    AND mt.id_estado = 1
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

// --- Alcance del profesor -------------------------------------------------
// Un profesor no ve cifras globales del club: solo lo que tiene a cargo.

// El token resuelve la persona; de ahí se llega a su ficha de profesor.
const getProfesorPorPersona = (id_persona) => pool.query(`
  SELECT id FROM tbd_profesor WHERE id_persona = $1 AND id_estado = 1 LIMIT 1
`, [id_persona])

// Deportistas activos de las categorías asignadas al profesor.
const getConteosProfesor = (id_profesor) => pool.query(`
  SELECT COUNT(*)::INT AS deportistas
  FROM tbd_deportista d
  WHERE d.id_estado = 1
    AND d.id_categoria IN (
      SELECT pxc.id_categoria FROM tbd_profesor_x_categoria pxc
       WHERE pxc.id_profesor = $1
    )
`, [id_profesor])

// Asistencia de las últimas 4 semanas, contada solo sobre los
// entrenamientos que el profesor tiene asignados.
const getAsistenciaProfesor = (id_profesor) => pool.query(`
  SELECT
    COUNT(*) FILTER (WHERE a.id_estado = 1)::INT AS presentes,
    COUNT(*)::INT AS total
  FROM tbd_asistencia a
  JOIN tbd_entrenamiento e ON a.id_entrenamiento = e.id
  JOIN tbd_entrenamiento_x_profesor exp ON exp.id_entrenamiento = e.id
  WHERE exp.id_profesor = $1
    AND e.id_estado = 1
    AND e.fecha >= CURRENT_DATE - INTERVAL '28 days'
    AND e.fecha <= CURRENT_DATE
`, [id_profesor])

// Próximos entrenamientos acotados a las categorías del profesor. Se
// filtra por categoría y no por asignación: un entrenamiento de su
// categoría que todavía no tiene profesor asignado igual le interesa,
// y desaparecería si el filtro fuera por asignación.
// `asignado` indica si además le corresponde dictarlo.
const getProximosEntrenamientosProfesor = (id_profesor) => pool.query(`
  SELECT e.id, e.fecha, e.hora_inicio, e.hora_fin,
    c.nombre AS cancha,
    cat.nombre AS categoria,
    EXISTS (
      SELECT 1 FROM tbd_entrenamiento_x_profesor exp
       WHERE exp.id_entrenamiento = e.id AND exp.id_profesor = $1
    ) AS asignado
  FROM tbd_entrenamiento e
  LEFT JOIN tbd_cancha c ON e.id_cancha = c.id
  LEFT JOIN tbd_categoria cat ON e.id_categoria = cat.id
  WHERE e.fecha >= CURRENT_DATE
    AND e.fecha <= CURRENT_DATE + INTERVAL '7 days'
    AND e.id_estado = 1
    AND e.id_categoria IN (
      SELECT pxc.id_categoria FROM tbd_profesor_x_categoria pxc
       WHERE pxc.id_profesor = $1
    )
  ORDER BY e.fecha, e.hora_inicio
  LIMIT 10
`, [id_profesor])

// --- Alcance del deportista -----------------------------------------------
// Solo ve lo suyo: los próximos entrenamientos de su categoría y quién los
// dirige. Ninguna cifra del club.

const getDeportistaPorPersona = (id_persona) => pool.query(`
  SELECT d.id, d.id_categoria, cat.nombre AS categoria
  FROM tbd_deportista d
  LEFT JOIN tbd_categoria cat ON cat.id = d.id_categoria
  WHERE d.id_persona = $1 AND d.id_estado = 1
  LIMIT 1
`, [id_persona])

// Próximos entrenamientos de una categoría, con quién los dirige.
const getProximosEntrenamientosCategoria = (id_categoria) => pool.query(`
  SELECT e.id, e.fecha, e.hora_inicio, e.hora_fin,
    c.nombre AS cancha,
    cat.nombre AS categoria,
    COALESCE(
      (SELECT json_agg(json_build_object('nombre', p.nombre, 'apellido', p.apellido) ORDER BY pr.id)
       FROM tbd_entrenamiento_x_profesor exp
       JOIN tbd_profesor pr ON pr.id = exp.id_profesor
       LEFT JOIN tbd_persona p ON p.id = pr.id_persona
       WHERE exp.id_entrenamiento = e.id),
      '[]'::json
    ) AS profesores
  FROM tbd_entrenamiento e
  LEFT JOIN tbd_cancha c ON e.id_cancha = c.id
  LEFT JOIN tbd_categoria cat ON e.id_categoria = cat.id
  WHERE e.fecha >= CURRENT_DATE
    AND e.fecha <= CURRENT_DATE + INTERVAL '7 days'
    AND e.id_estado = 1
    AND e.id_categoria = $1
  ORDER BY e.fecha, e.hora_inicio
  LIMIT 10
`, [id_categoria])

// Entrenadores a cargo de la categoría. Se toma de la asignación de
// categorías del profesor, no de los entrenamientos: así el deportista ve
// a su entrenador aunque todavía no haya sesiones agendadas.
const getProfesoresDeCategoria = (id_categoria) => pool.query(`
  SELECT pr.id, p.nombre, p.apellido, p.correo, p.numero_telefono
  FROM tbd_profesor_x_categoria pxc
  JOIN tbd_profesor pr ON pr.id = pxc.id_profesor
  LEFT JOIN tbd_persona p ON p.id = pr.id_persona
  WHERE pxc.id_categoria = $1 AND pr.id_estado = 1
  ORDER BY p.nombre, p.apellido
`, [id_categoria])

module.exports = {
  getDeportistaPorPersona,
  getProximosEntrenamientosCategoria,
  getProfesoresDeCategoria,
  getProximosEntrenamientosProfesor,
  getProfesorPorPersona,
  getConteosProfesor,
  getAsistenciaProfesor,
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
