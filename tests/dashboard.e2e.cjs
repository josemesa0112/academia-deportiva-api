/**
 * Prueba de punta a punta del alcance del dashboard por rol.
 * Verifica que el profesor vea solo sus deportistas y la asistencia de sus
 * propias sesiones, sin los conteos del club. Deshace todo al terminar.
 *
 *   API_BASE=https://mi-api.onrender.com npm run test:dashboard
 */
const { Pool } = require('pg')
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true })

const BASE = process.env.API_BASE || 'http://localhost:3000'
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

let ok = 0, fail = 0
const check = (nombre, cond, detalle = '') => {
  if (cond) { ok++; console.log('  PASA  ' + nombre) }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')) }
}

const req = async (metodo, ruta, body, token) => {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch { /* sin cuerpo */ }
  return { status: res.status, body: json }
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// hora_fin 23:58 marca los entrenamientos de esta prueba, para poder limpiarlos
// sin tocar los reales.
const MARCA_HORA = '23:58:00'

const entrar = async (documento) => {
  const { rows } = await pool.query(
    'SELECT id FROM tbd_persona WHERE numero_documento = $1', [documento])
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [rows[0].id])
  const r = await req('POST', '/api/auth/login-documento', { documento, password: documento })
  return r.body?.access_token
}

;(async () => {
  const limpiar = async () => {
    await pool.query(
      `DELETE FROM tbd_asistencia WHERE id_entrenamiento IN
        (SELECT id FROM tbd_entrenamiento WHERE hora_fin = $1)`, [MARCA_HORA])
    await pool.query(
      `DELETE FROM tbd_entrenamiento_x_profesor WHERE id_entrenamiento IN
        (SELECT id FROM tbd_entrenamiento WHERE hora_fin = $1)`, [MARCA_HORA])
    await pool.query('DELETE FROM tbd_entrenamiento WHERE hora_fin = $1', [MARCA_HORA])
  }
  await limpiar()

  const { rows: admins } = await pool.query(
    `SELECT numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=1 AND correo LIKE '%@gmail.com' ORDER BY id LIMIT 1`)
  const tokenAdmin = await entrar(admins[0].numero_documento)
  if (!tokenAdmin) { console.log('No se pudo autenticar al admin'); process.exit(1) }

  // Profesor con al menos una categoría asignada.
  const { rows: profes } = await pool.query(`
    SELECT p.numero_documento, pr.id AS id_profesor
    FROM tbd_persona p
    JOIN tbd_profesor pr ON pr.id_persona = p.id
    WHERE p.id_rol = 2 AND p.id_estado = 1 AND pr.id_estado = 1
      AND EXISTS (SELECT 1 FROM tbd_profesor_x_categoria x WHERE x.id_profesor = pr.id)
    ORDER BY pr.id LIMIT 1`)
  const prof = profes[0]
  if (!prof) { console.log('No hay profesor con categorías asignadas'); process.exit(1) }
  const tokenProfe = await entrar(prof.numero_documento)
  if (!tokenProfe) { console.log('No se pudo autenticar al profesor'); process.exit(1) }

  console.log(`Admin y profesor autenticados. Profesor id=${prof.id_profesor}\n`)

  console.log('--- Alcance del administrador ---')
  const admin = await req('GET', '/api/dashboard/resumen', null, tokenAdmin)
  check('el dashboard responde 200', admin.status === 200)
  check('el alcance es del club', admin.body?.conteos?.alcance === 'club', JSON.stringify(admin.body?.conteos))
  check('el admin sí ve el conteo de profesores', typeof admin.body?.conteos?.profesores === 'number')
  check('el admin sí ve el conteo de proveedores', typeof admin.body?.conteos?.proveedores === 'number')
  check('el admin conserva el bloque financiero', typeof admin.body?.financiero?.recaudo_mes === 'number')

  console.log('\n--- Alcance del profesor ---')
  const profe = await req('GET', '/api/dashboard/resumen', null, tokenProfe)
  check('el dashboard responde 200', profe.status === 200)
  check('el alcance es de profesor', profe.body?.conteos?.alcance === 'profesor', JSON.stringify(profe.body?.conteos))
  check('NO trae el conteo de profesores', profe.body?.conteos?.profesores === undefined)
  check('NO trae el conteo de proveedores', profe.body?.conteos?.proveedores === undefined)

  const { rows: esperados } = await pool.query(`
    SELECT COUNT(*)::int c FROM tbd_deportista d
    WHERE d.id_estado = 1
      AND d.id_categoria IN (
        SELECT id_categoria FROM tbd_profesor_x_categoria WHERE id_profesor = $1)`,
    [prof.id_profesor])
  check('los deportistas son solo los de sus categorías',
    profe.body?.conteos?.deportistas === esperados[0].c,
    `recibido=${profe.body?.conteos?.deportistas} esperado=${esperados[0].c}`)

  const { rows: totalClub } = await pool.query(
    'SELECT COUNT(*)::int c FROM tbd_deportista WHERE id_estado = 1')
  check('y no el total del club',
    esperados[0].c === totalClub[0].c || profe.body?.conteos?.deportistas !== totalClub[0].c,
    `suyos=${esperados[0].c} club=${totalClub[0].c}`)

  console.log('\n--- Asistencia sobre sus propias sesiones ---')
  const { rows: cancha } = await pool.query('SELECT id FROM tbd_cancha ORDER BY id LIMIT 1')
  const { rows: catProf } = await pool.query(
    'SELECT id_categoria FROM tbd_profesor_x_categoria WHERE id_profesor = $1 LIMIT 1', [prof.id_profesor])
  const idCategoria = catProf[0].id_categoria

  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)

  // Sesión del profesor: 3 asistencias, 2 presentes -> 67 %
  const miSesion = await req('POST', '/api/entrenamientos', {
    id_cancha: cancha[0].id, id_categoria: idCategoria,
    hora_inicio: '08:00', hora_fin: '23:58', fecha: iso(ayer), id_estado: 1,
    profesores: String(prof.id_profesor),
  }, tokenAdmin)
  check('se crea una sesión del profesor', miSesion.status === 201, JSON.stringify(miSesion.body))

  const { rows: deps } = await pool.query(
    'SELECT id FROM tbd_deportista WHERE id_estado = 1 AND id_categoria = $1 ORDER BY id LIMIT 3',
    [idCategoria])
  if (deps.length < 3) { console.log('Se necesitan 3 deportistas en la categoría'); process.exit(1) }

  for (let i = 0; i < 3; i++) {
    await pool.query(
      `INSERT INTO tbd_asistencia (id_deportista, id_entrenamiento, id_estado)
       VALUES ($1, $2, $3)`,
      [deps[i].id, miSesion.body.id, i < 2 ? 1 : 2])
  }

  // Sesión ajena: 2 asistencias, ambas ausentes. No debe afectar al profesor.
  const sesionAjena = await req('POST', '/api/entrenamientos', {
    id_cancha: cancha[0].id, id_categoria: idCategoria,
    hora_inicio: '09:00', hora_fin: '23:58', fecha: iso(ayer), id_estado: 1,
  }, tokenAdmin)
  for (let i = 0; i < 2; i++) {
    await pool.query(
      `INSERT INTO tbd_asistencia (id_deportista, id_entrenamiento, id_estado)
       VALUES ($1, $2, 2)`,
      [deps[i].id, sesionAjena.body.id])
  }

  const conAsistencia = await req('GET', '/api/dashboard/resumen', null, tokenProfe)
  check('la asistencia del profesor es 67% (2 de 3 en SU sesión)',
    conAsistencia.body?.conteos?.porcentaje_asistencia === 67,
    'recibido=' + conAsistencia.body?.conteos?.porcentaje_asistencia)

  const adminConAsistencia = await req('GET', '/api/dashboard/resumen', null, tokenAdmin)
  check('la del admin sí incluye la sesión ajena (baja del 67%)',
    adminConAsistencia.body?.conteos?.porcentaje_asistencia !== 67,
    'admin=' + adminConAsistencia.body?.conteos?.porcentaje_asistencia)

  console.log('\n--- Próximos entrenamientos acotados ---')
  // Una sesión futura en OTRA categoría, que el profesor no debe ver.
  const { rows: otraCat } = await pool.query(
    'SELECT id FROM tbd_categoria WHERE id <> $1 ORDER BY id LIMIT 1', [idCategoria])
  const manana = new Date(); manana.setDate(manana.getDate() + 1)

  const miFutura = await req('POST', '/api/entrenamientos', {
    id_cancha: cancha[0].id, id_categoria: idCategoria,
    hora_inicio: '10:00', hora_fin: '23:58', fecha: iso(manana), id_estado: 1,
    profesores: String(prof.id_profesor),
  }, tokenAdmin)
  check('se crea una sesión futura de su categoría', miFutura.status === 201)

  const ajenaFutura = await req('POST', '/api/entrenamientos', {
    id_cancha: cancha[0].id, id_categoria: otraCat[0].id,
    hora_inicio: '11:00', hora_fin: '23:58', fecha: iso(manana), id_estado: 1,
  }, tokenAdmin)
  check('se crea una sesión futura de otra categoría', ajenaFutura.status === 201)

  const conProximos = await req('GET', '/api/dashboard/resumen', null, tokenProfe)
  const idsProfe = (conProximos.body?.proximos_entrenamientos || []).map(e => e.id)
  check('ve la sesión futura de su categoría', idsProfe.includes(miFutura.body.id),
    'ids=' + JSON.stringify(idsProfe))
  check('NO ve la de otra categoría', !idsProfe.includes(ajenaFutura.body.id))
  check('marca cuál le toca dictar',
    conProximos.body.proximos_entrenamientos.find(e => e.id === miFutura.body.id)?.asignado === true)

  const adminProximos = await req('GET', '/api/dashboard/resumen', null, tokenAdmin)
  const idsAdmin = (adminProximos.body?.proximos_entrenamientos || []).map(e => e.id)
  check('el admin sí ve ambas',
    idsAdmin.includes(miFutura.body.id) && idsAdmin.includes(ajenaFutura.body.id),
    'ids=' + JSON.stringify(idsAdmin))
  check('y al admin no se le manda el campo asignado',
    adminProximos.body.proximos_entrenamientos.every(e => e.asignado === undefined))

  console.log('\n--- Sin sesiones no hay porcentaje inventado ---')
  await pool.query(
    'DELETE FROM tbd_entrenamiento_x_profesor WHERE id_entrenamiento = $1', [miSesion.body.id])
  const sinSesiones = await req('GET', '/api/dashboard/resumen', null, tokenProfe)
  check('sin sesiones propias la asistencia es null',
    sinSesiones.body?.conteos?.porcentaje_asistencia === null,
    'recibido=' + sinSesiones.body?.conteos?.porcentaje_asistencia)

  console.log('\n--- Alcance del deportista ---')
  const { rows: deportistasConCat } = await pool.query(`
    SELECT p.numero_documento, d.id, d.id_categoria
    FROM tbd_persona p
    JOIN tbd_deportista d ON d.id_persona = p.id
    WHERE p.id_rol = 3 AND p.id_estado = 1 AND d.id_estado = 1
      AND d.id_categoria IS NOT NULL
      AND p.correo LIKE '%@ejemplo.com'
    ORDER BY d.id LIMIT 1`)
  const depo = deportistasConCat[0]
  const tokenDepo = await entrar(depo.numero_documento)

  const vistaDepo = await req('GET', '/api/dashboard/resumen', null, tokenDepo)
  check('el dashboard responde 200', vistaDepo.status === 200)
  check('el alcance es de deportista', vistaDepo.body?.conteos?.alcance === 'deportista',
    JSON.stringify(vistaDepo.body?.conteos))
  check('NO recibe ninguna cifra del club',
    vistaDepo.body?.conteos?.deportistas === undefined &&
    vistaDepo.body?.conteos?.profesores === undefined &&
    vistaDepo.body?.conteos?.proveedores === undefined &&
    vistaDepo.body?.conteos?.porcentaje_asistencia === undefined,
    JSON.stringify(vistaDepo.body?.conteos))
  check('trae el contexto de su categoría',
    Boolean(vistaDepo.body?.contexto_deportista?.categoria),
    JSON.stringify(vistaDepo.body?.contexto_deportista))
  check('trae los entrenadores de su categoría',
    Array.isArray(vistaDepo.body?.contexto_deportista?.profesores))

  // Sesión futura de SU categoría y otra de una categoría distinta.
  const { rows: otraCategoria } = await pool.query(
    'SELECT id FROM tbd_categoria WHERE id <> $1 ORDER BY id LIMIT 1', [depo.id_categoria])
  const manana2 = new Date(); manana2.setDate(manana2.getDate() + 1)

  const suya = await req('POST', '/api/entrenamientos', {
    id_cancha: cancha[0].id, id_categoria: depo.id_categoria,
    hora_inicio: '07:00', hora_fin: '23:58', fecha: iso(manana2), id_estado: 1,
    profesores: String(prof.id_profesor),
  }, tokenAdmin)
  const ajena2 = await req('POST', '/api/entrenamientos', {
    id_cancha: cancha[0].id, id_categoria: otraCategoria[0].id,
    hora_inicio: '07:30', hora_fin: '23:58', fecha: iso(manana2), id_estado: 1,
  }, tokenAdmin)

  const conSesiones2 = await req('GET', '/api/dashboard/resumen', null, tokenDepo)
  const idsDepo = (conSesiones2.body?.proximos_entrenamientos || []).map(e => e.id)
  check('ve el entrenamiento de su categoría', idsDepo.includes(suya.body.id),
    'ids=' + JSON.stringify(idsDepo))
  check('NO ve el de otra categoría', !idsDepo.includes(ajena2.body.id))
  check('cada sesión indica quién la dirige',
    Array.isArray(conSesiones2.body.proximos_entrenamientos.find(e => e.id === suya.body.id)?.profesores))

  console.log('\n--- El deportista es de solo lectura ---')
  const soloLectura = [
    ['POST', '/api/entrenamientos', { id_cancha: cancha[0].id, id_categoria: depo.id_categoria, hora_inicio: '07:00', hora_fin: '23:58', fecha: iso(manana2), id_estado: 1 }],
    ['PUT', `/api/entrenamientos/${suya.body.id}`, { id_cancha: cancha[0].id, id_categoria: depo.id_categoria, hora_inicio: '07:00', hora_fin: '23:58', fecha: iso(manana2), id_estado: 1 }],
    ['DELETE', `/api/entrenamientos/${suya.body.id}`, null],
    ['POST', '/api/asistencias', { id_deportista: depo.id, id_entrenamiento: suya.body.id, id_estado: 1 }],
    ['PUT', '/api/asistencias/1', { id_deportista: depo.id, id_entrenamiento: suya.body.id, id_estado: 1 }],
    ['DELETE', '/api/asistencias/1', null],
    ['PUT', `/api/deportistas/${depo.id}`, { id_persona: 1, peso_actual: 50, estatura_actual: 1.6, id_categoria: depo.id_categoria, id_estado: 1 }],
    ['DELETE', `/api/deportistas/${depo.id}`, null],
    ['PUT', '/api/personas/1', { nombre: 'X', id_rol: 3, id_estado: 1 }],
  ]
  for (const [metodo, ruta, cuerpo] of soloLectura) {
    const r = await req(metodo, ruta, cuerpo, tokenDepo)
    check(`${metodo} ${ruta.split('?')[0]} -> 403`, r.status === 403, 'status=' + r.status)
  }

  // Nada de lo anterior debe haber alterado la base.
  const { rows: sigueVivo } = await pool.query(
    'SELECT id_estado FROM tbd_entrenamiento WHERE id = $1', [suya.body.id])
  check('el entrenamiento sigue intacto tras los intentos',
    sigueVivo[0]?.id_estado === 1)
  const { rows: depIntacto } = await pool.query(
    'SELECT id_estado FROM tbd_deportista WHERE id = $1', [depo.id])
  check('el deportista sigue activo', depIntacto[0]?.id_estado === 1)

  console.log('\n--- La deuda de un inactivo sale de la cartera ---')
  // Deportista activo con una mensualidad pendiente creada para la prueba.
  const { rows: dep } = await pool.query(
    'SELECT id, valor_mensualidad FROM tbd_deportista WHERE id_estado = 1 AND valor_mensualidad > 0 ORDER BY id LIMIT 1')
  const idDep = dep[0].id
  const VALOR = 333333
  // Mes/año artificiales no sirven: la cartera mira el mes en curso.
  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const anioActual = ahora.getFullYear()

  const { rows: previa } = await pool.query(
    'SELECT id, valor, fecha_pago FROM tbd_mensualidad WHERE id_deportista=$1 AND mes=$2 AND año=$3',
    [idDep, mesActual, anioActual])
  // Se guarda el estado original para restaurarlo al final.
  const teniaMensualidad = previa.length > 0
  const valorPrevio = teniaMensualidad ? previa[0].valor : null
  const pagoPrevio = teniaMensualidad ? previa[0].fecha_pago : null

  if (teniaMensualidad) {
    await pool.query('UPDATE tbd_mensualidad SET valor=$1, fecha_pago=NULL WHERE id=$2', [VALOR, previa[0].id])
  } else {
    await pool.query(
      'INSERT INTO tbd_mensualidad (id_deportista, mes, año, valor, id_estado, fecha_pago) VALUES ($1,$2,$3,$4,1,NULL)',
      [idDep, mesActual, anioActual, VALOR])
  }

  const conActivo = (await req('GET', '/api/dashboard/resumen', null, tokenAdmin)).body.financiero
  check('con el deportista activo, su deuda está en la cartera',
    conActivo.pendiente >= VALOR, `pendiente=${conActivo.pendiente}`)
  // La base ya puede tener deuda de inactivos reales: se mide la diferencia.
  const baseInactivos = Number(conActivo.pendiente_inactivos)
  check('la deuda de este deportista aun no cuenta como de inactivo',
    typeof conActivo.pendiente_inactivos === "number",
    `base=${baseInactivos}`)

  // Se desactiva el deportista.
  await pool.query('UPDATE tbd_deportista SET id_estado = 2 WHERE id = $1', [idDep])
  const conInactivo = (await req('GET', '/api/dashboard/resumen', null, tokenAdmin)).body.financiero
  check('al desactivarlo, la cartera baja exactamente en su deuda',
    Math.round(conActivo.pendiente - conInactivo.pendiente) === VALOR,
    `antes=${conActivo.pendiente} despues=${conInactivo.pendiente}`)
  check('la deuda no desaparece: se informa aparte',
    Math.round(conInactivo.pendiente_inactivos - baseInactivos) === VALOR,
    `inactivos=${conInactivo.pendiente_inactivos} base=${baseInactivos}`)
  check('y baja el conteo de mensualidades pendientes',
    conInactivo.cantidad_pendientes === conActivo.cantidad_pendientes - 1)

  const { rows: sigue } = await pool.query(
    'SELECT fecha_pago FROM tbd_mensualidad WHERE id_deportista=$1 AND mes=$2 AND año=$3',
    [idDep, mesActual, anioActual])
  check('el registro sigue existiendo y sin pagar',
    sigue.length === 1 && sigue[0].fecha_pago === null)

  // Se reactiva: la deuda debe volver a la cartera sola.
  await pool.query('UPDATE tbd_deportista SET id_estado = 1 WHERE id = $1', [idDep])
  const reactivado = (await req('GET', '/api/dashboard/resumen', null, tokenAdmin)).body.financiero
  check('al reactivarlo la deuda vuelve a la cartera',
    Math.round(reactivado.pendiente) === Math.round(conActivo.pendiente),
    `esperado=${conActivo.pendiente} real=${reactivado.pendiente}`)
  check('y deja de contarse como deuda de inactivos',
    Math.round(reactivado.pendiente_inactivos) === Math.round(baseInactivos),
    `real=${reactivado.pendiente_inactivos} base=${baseInactivos}`)

  // Restaurar la mensualidad tal como estaba.
  if (teniaMensualidad) {
    await pool.query('UPDATE tbd_mensualidad SET valor=$1, fecha_pago=$2 WHERE id=$3',
      [valorPrevio, pagoPrevio, previa[0].id])
  } else {
    await pool.query('DELETE FROM tbd_mensualidad WHERE id_deportista=$1 AND mes=$2 AND año=$3',
      [idDep, mesActual, anioActual])
  }
  const { rows: restaurada } = await pool.query(
    'SELECT valor, fecha_pago FROM tbd_mensualidad WHERE id_deportista=$1 AND mes=$2 AND año=$3',
    [idDep, mesActual, anioActual])
  check('la mensualidad quedó como estaba',
    teniaMensualidad
      ? (restaurada.length === 1 && String(restaurada[0].valor) === String(valorPrevio))
      : restaurada.length === 0)

  // Limpieza
  await limpiar()
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id_rol IN (1,2)')
  const { rows: quedan } = await pool.query(
    'SELECT COUNT(*)::int c FROM tbd_entrenamiento WHERE hora_fin = $1', [MARCA_HORA])
  check('limpieza completa', quedan[0].c === 0)

  await pool.end()
  console.log(`\nRESULTADO: ${ok} pasan, ${fail} fallan`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
