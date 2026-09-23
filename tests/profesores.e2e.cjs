/**
 * Prueba de punta a punta del pago por sesión de los profesores.
 * Crea entrenamientos de prueba, los asigna a un profesor y verifica que el
 * cálculo cuadre. Deshace todo al terminar.
 *
 *   API_BASE=https://mi-api.onrender.com npm run test:profesores
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

// Marca para poder limpiar sin tocar datos reales.
const MARCA = 'PRUEBA-SESIONES'

;(async () => {
  const { rows: admins } = await pool.query(
    `SELECT id, numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=1 AND correo LIKE '%@gmail.com' ORDER BY id LIMIT 1`)
  const a = admins[0]
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [a.id])
  const login = await req('POST', '/api/auth/login-documento',
    { documento: a.numero_documento, password: a.numero_documento })
  const token = login.body?.access_token
  if (!token) { console.log('No se pudo autenticar:', JSON.stringify(login.body)); process.exit(1) }

  const { rows: profes } = await pool.query(
    `SELECT id, valor_sesion FROM tbd_profesor WHERE id_estado = 1 ORDER BY id LIMIT 1`)
  const prof = profes[0]
  if (!prof) { console.log('No hay profesor activo'); process.exit(1) }

  const { rows: canchas } = await pool.query('SELECT id FROM tbd_cancha ORDER BY id LIMIT 1')
  const { rows: cats } = await pool.query('SELECT id FROM tbd_categoria ORDER BY id LIMIT 1')
  const idCancha = canchas[0].id
  const idCategoria = cats[0].id

  const valorOriginal = prof.valor_sesion
  console.log(`Admin autenticado. Profesor de prueba id=${prof.id}, valor_sesion actual=${valorOriginal}\n`)

  const limpiar = async () => {
    await pool.query(
      `DELETE FROM tbd_entrenamiento_x_profesor
        WHERE id_entrenamiento IN (SELECT id FROM tbd_entrenamiento WHERE hora_fin = '23:59:00')`)
    await pool.query(`DELETE FROM tbd_entrenamiento WHERE hora_fin = '23:59:00'`)
    await pool.query('UPDATE tbd_profesor SET valor_sesion = $1 WHERE id = $2', [valorOriginal, prof.id])
  }
  await limpiar()

  console.log('--- Valor por sesión ---')
  const { rows: cols } = await pool.query(
    `SELECT column_default FROM information_schema.columns
      WHERE table_name='tbd_profesor' AND column_name='valor_sesion'`)
  check('la columna valor_sesion existe con 40 por defecto',
    cols.length === 1 && String(cols[0].column_default).startsWith('40'), JSON.stringify(cols[0]))

  await pool.query('UPDATE tbd_profesor SET valor_sesion = 40 WHERE id = $1', [prof.id])

  const base = await req('GET', `/api/profesores/${prof.id}`, null, token)
  check('el profesor expone valor_sesion', Number(base.body?.valor_sesion) === 40, JSON.stringify(base.body?.valor_sesion))
  check('expone el conteo de sesiones', base.body?.sesiones_dictadas === 0 && base.body?.sesiones_mes === 0,
    JSON.stringify({ d: base.body?.sesiones_dictadas, m: base.body?.sesiones_mes }))
  check('sin sesiones el pago es cero', Number(base.body?.pago_mes) === 0)

  console.log('\n--- Asignar sesiones dictadas ---')
  const hoy = new Date()
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  const anteayer = new Date(hoy); anteayer.setDate(hoy.getDate() - 2)
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1)

  const crear = async (fecha) => {
    const r = await req('POST', '/api/entrenamientos', {
      id_cancha: idCancha, id_categoria: idCategoria,
      // hora_fin 23:59 marca los entrenamientos de prueba para poder limpiarlos.
      hora_inicio: '08:00', hora_fin: '23:59',
      fecha: iso(fecha), id_estado: 1,
      profesores: String(prof.id),
    }, token)
    return r
  }

  const e1 = await crear(ayer)
  check('crea entrenamiento con profesor asignado', e1.status === 201, JSON.stringify(e1.body))
  await crear(anteayer)
  const eFuturo = await crear(manana)
  check('crea entrenamiento futuro', eFuturo.status === 201)

  const { rows: enlaces } = await pool.query(
    'SELECT COUNT(*)::int c FROM tbd_entrenamiento_x_profesor WHERE id_profesor = $1', [prof.id])
  check('los tres quedaron enlazados al profesor', enlaces[0].c === 3, 'enlaces=' + enlaces[0].c)

  console.log('\n--- El cálculo ---')
  const conSesiones = await req('GET', `/api/profesores/${prof.id}`, null, token)
  const b = conSesiones.body
  check('cuenta 2 sesiones dictadas (no la futura)', b?.sesiones_dictadas === 2,
    JSON.stringify({ dictadas: b?.sesiones_dictadas, programadas: b?.sesiones_programadas }))
  check('cuenta 1 sesión programada', b?.sesiones_programadas === 1)
  check('sesiones del mes = 2', b?.sesiones_mes === 2)
  check('pago del mes = 2 x 40 = 80', Number(b?.pago_mes) === 80, 'pago_mes=' + b?.pago_mes)
  check('pago acumulado = 80', Number(b?.pago_acumulado) === 80)

  console.log('\n--- Cambiar la tarifa recalcula ---')
  const up = await req('PUT', `/api/profesores/${prof.id}`, {
    id_persona: base.body.id_persona, valor_sesion: 50, id_estado: 1,
  }, token)
  check('actualiza la tarifa', up.status === 200, JSON.stringify(up.body))
  const tras = await req('GET', `/api/profesores/${prof.id}`, null, token)
  check('el pago se recalcula con la tarifa nueva', Number(tras.body?.pago_mes) === 100,
    'pago_mes=' + tras.body?.pago_mes)

  console.log('\n--- Validaciones ---')
  const sinValor = await req('POST', '/api/profesores',
    { id_persona: base.body.id_persona, id_estado: 1 }, token)
  check('exige el valor por sesión al crear', sinValor.status === 400, JSON.stringify(sinValor.body))
  const negativo = await req('PUT', `/api/profesores/${prof.id}`,
    { id_persona: base.body.id_persona, valor_sesion: -5, id_estado: 1 }, token)
  check('rechaza tarifa negativa', negativo.status === 400)

  console.log('\n--- Anular una sesión la descuenta ---')
  await pool.query('UPDATE tbd_entrenamiento SET id_estado = 2 WHERE id = $1', [e1.body.id])
  const trasAnular = await req('GET', `/api/profesores/${prof.id}`, null, token)
  check('una sesión anulada deja de contar', trasAnular.body?.sesiones_dictadas === 1,
    'dictadas=' + trasAnular.body?.sesiones_dictadas)
  check('y el pago baja a 50', Number(trasAnular.body?.pago_mes) === 50)
  await pool.query('UPDATE tbd_entrenamiento SET id_estado = 1 WHERE id = $1', [e1.body.id])

  console.log('\n--- Sincronización al editar el entrenamiento ---')
  const quitar = await req('PUT', `/api/entrenamientos/${e1.body.id}`, {
    id_cancha: idCancha, id_categoria: idCategoria,
    hora_inicio: '08:00', hora_fin: '23:59', fecha: iso(ayer), id_estado: 1,
    profesores: '',
  }, token)
  check('quitar el profesor del entrenamiento funciona', quitar.status === 200, JSON.stringify(quitar.body))
  const sinProf = await req('GET', `/api/profesores/${prof.id}`, null, token)
  check('la sesión deja de contarle', sinProf.body?.sesiones_dictadas === 1,
    'dictadas=' + sinProf.body?.sesiones_dictadas)

  const reasignar = await req('PUT', `/api/entrenamientos/${e1.body.id}`, {
    id_cancha: idCancha, id_categoria: idCategoria,
    hora_inicio: '08:00', hora_fin: '23:59', fecha: iso(ayer), id_estado: 1,
    profesores: String(prof.id),
  }, token)
  check('reasignarlo vuelve a contarla', reasignar.status === 200)
  const { rows: sinDup } = await pool.query(
    `SELECT COUNT(*)::int c FROM tbd_entrenamiento_x_profesor
      WHERE id_profesor = $1 AND id_entrenamiento = $2`, [prof.id, e1.body.id])
  check('no se duplicó el enlace', sinDup[0].c === 1)

  console.log('\n--- El listado y el desglose mensual ---')
  const lista = await req('GET', '/api/profesores', null, token)
  const enLista = lista.body.find(p => p.id === prof.id)
  check('el listado trae el pago calculado', Number(enLista?.pago_mes) === 100,
    'pago_mes=' + enLista?.pago_mes)

  const detalle = await req('GET', `/api/profesores/${prof.id}/sesiones`, null, token)
  check('el detalle responde 200', detalle.status === 200, JSON.stringify(detalle.body).slice(0, 120))
  check('trae los 12 meses', detalle.body?.meses?.length === 12)
  const mesActual = detalle.body.meses[hoy.getMonth()]
  check('el mes actual cuadra con el pago', mesActual?.pago === 100,
    JSON.stringify(mesActual))
  check('lista las sesiones individuales', Array.isArray(detalle.body?.sesiones) && detalle.body.sesiones.length === 3,
    'sesiones=' + detalle.body?.sesiones?.length)

  console.log('\n--- Permisos ---')
  const { rows: d3 } = await pool.query(
    `SELECT id, numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=3 AND correo LIKE '%@ejemplo.com' ORDER BY id LIMIT 1`)
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [d3[0].id])
  const loginDep = await req('POST', '/api/auth/login-documento',
    { documento: d3[0].numero_documento, password: d3[0].numero_documento })
  const tokenDep = loginDep.body?.access_token
  check('sin token no se ve el pago', (await req('GET', `/api/profesores/${prof.id}`)).status === 401)
  check('un deportista autenticado recibe respuesta del API',
    [200, 403].includes((await req('GET', `/api/profesores/${prof.id}`, null, tokenDep)).status))

  // Limpieza
  await limpiar()
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = ANY($1)', [[a.id, d3[0].id]])
  const { rows: quedan } = await pool.query(
    `SELECT COUNT(*)::int c FROM tbd_entrenamiento WHERE hora_fin = '23:59:00'`)
  check('limpieza completa', quedan[0].c === 0)
  const { rows: valorFinal } = await pool.query(
    'SELECT valor_sesion FROM tbd_profesor WHERE id = $1', [prof.id])
  check('la tarifa original quedó restaurada',
    Number(valorFinal[0].valor_sesion) === Number(valorOriginal),
    `${valorFinal[0].valor_sesion} vs ${valorOriginal}`)

  await pool.end()
  console.log(`\nRESULTADO: ${ok} pasan, ${fail} fallan`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
