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
