/**
 * Prueba de punta a punta de la grilla anual de mensualidades.
 * Verifica marcar/desmarcar cualquier mes, incluida la creación al vuelo de
 * meses futuros (pagos por adelantado). Deshace todo al terminar.
 *
 *   API_BASE=https://mi-api.onrender.com npm run test:mensualidades
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

// Año fuera del rango normal de datos, para no ensuciar los reales.
const AÑO = 2031

;(async () => {
  const { rows: admins } = await pool.query(
    `SELECT id, correo, numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=1 AND correo LIKE '%@gmail.com' ORDER BY id LIMIT 1`)
  const a = admins[0]
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [a.id])
  const login = await req('POST', '/api/auth/login-documento', { documento: a.numero_documento, password: a.numero_documento })
  const token = login.body?.access_token
  if (!token) { console.log('No se pudo autenticar:', JSON.stringify(login.body)); process.exit(1) }

  // Deportista de prueba: activo y con valor de mensualidad definido.
  const { rows: deps } = await pool.query(
    `SELECT d.id, d.valor_mensualidad FROM tbd_deportista d
      WHERE d.id_estado = 1 AND d.valor_mensualidad > 0 ORDER BY d.id LIMIT 1`)
  const dep = deps[0]
  if (!dep) { console.log('No hay deportista con valor_mensualidad'); process.exit(1) }
  console.log(`Admin autenticado. Deportista de prueba id=${dep.id} valor=${dep.valor_mensualidad}, año ${AÑO}\n`)

  await pool.query('DELETE FROM tbd_mensualidad WHERE año = $1', [AÑO])

  console.log('--- Acceso y forma de la respuesta ---')
  check('sin token da 401', (await req('GET', `/api/mensualidades/anio/${AÑO}`)).status === 401)

  const m0 = await req('GET', `/api/mensualidades/anio/${AÑO}`, null, token)
  check('la grilla responde 200', m0.status === 200)
  check('trae el año pedido', m0.body?.año === AÑO)
  check('trae deportistas', Array.isArray(m0.body?.deportistas) && m0.body.deportistas.length > 0)
  const fila0 = m0.body.deportistas.find(d => d.id_deportista === dep.id)
  check('cada deportista trae 12 meses', fila0?.meses?.length === 12, `largo=${fila0?.meses?.length}`)
  check('un año sin datos viene todo en null', fila0.meses.every(c => c === null))
  check('trae totales por mes', Array.isArray(m0.body?.totales_por_mes) && m0.body.totales_por_mes.length === 12)

  console.log('\n--- Validaciones ---')
  check('mes 0 se rechaza', (await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes: 0, año: AÑO, pagada: true }, token)).status === 400)
  check('mes 13 se rechaza', (await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes: 13, año: AÑO, pagada: true }, token)).status === 400)
  check('año inválido se rechaza', (await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes: 5, año: 1800, pagada: true }, token)).status === 400)
  check('pagada no booleana se rechaza', (await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes: 5, año: AÑO, pagada: 'si' }, token)).status === 400)
  check('deportista inexistente da 404', (await req('POST', '/api/mensualidades/marcar', { id_deportista: 999999, mes: 5, año: AÑO, pagada: true }, token)).status === 404)
  check('revertir un mes que no existe da 404',
    (await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes: 7, año: AÑO, pagada: false }, token)).status === 404)

  console.log('\n--- Pago por adelantado (el caso que importa) ---')
  // Diciembre no existe todavía: marcarlo debe crear la fila.
  const dic = await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes: 12, año: AÑO, pagada: true }, token)
  check('marca diciembre sin que exista la fila', dic.status === 200, JSON.stringify(dic.body))
  const { rows: creada } = await pool.query(
    'SELECT id, valor, fecha_pago, id_estado FROM tbd_mensualidad WHERE id_deportista=$1 AND mes=12 AND año=$2', [dep.id, AÑO])
  check('la fila quedó creada en la base', creada.length === 1)
  check('quedó con fecha de pago', creada[0]?.fecha_pago !== null)
  check('tomó el valor de mensualidad del deportista', Number(creada[0]?.valor) === Number(dep.valor_mensualidad),
    `valor=${creada[0]?.valor} esperado=${dep.valor_mensualidad}`)

  // Varios meses adelantados de una vez.
  for (const mes of [9, 10, 11]) {
    await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes, año: AÑO, pagada: true }, token)
  }
  const m1 = await req('GET', `/api/mensualidades/anio/${AÑO}`, null, token)
  const fila1 = m1.body.deportistas.find(d => d.id_deportista === dep.id)
  check('la grilla muestra 4 meses pagados', fila1.meses.filter(c => c?.pagada).length === 4,
    JSON.stringify(fila1.meses.map(c => (c ? (c.pagada ? 'P' : 'x') : '-')).join('')))
  check('los meses no tocados siguen en null', fila1.meses.slice(0, 8).every(c => c === null))

  console.log('\n--- Idempotencia y reversión ---')
  const repetido = await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes: 12, año: AÑO, pagada: true }, token)
  check('marcar dos veces no falla', repetido.status === 200)
  const { rows: sinDuplicar } = await pool.query(
    'SELECT COUNT(*)::int c FROM tbd_mensualidad WHERE id_deportista=$1 AND mes=12 AND año=$2', [dep.id, AÑO])
  check('no se duplicó la fila', sinDuplicar[0].c === 1)

  const revertido = await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes: 12, año: AÑO, pagada: false }, token)
  check('revierte el pago', revertido.status === 200)
  const m2 = await req('GET', `/api/mensualidades/anio/${AÑO}`, null, token)
  const fila2 = m2.body.deportistas.find(d => d.id_deportista === dep.id)
  check('diciembre queda pendiente pero la fila sigue existiendo',
    fila2.meses[11] !== null && fila2.meses[11].pagada === false)
  check('vuelve a marcarse sin problema',
    (await req('POST', '/api/mensualidades/marcar', { id_deportista: dep.id, mes: 12, año: AÑO, pagada: true }, token)).status === 200)

  console.log('\n--- Totales ---')
  const m3 = await req('GET', `/api/mensualidades/anio/${AÑO}`, null, token)
  const totalDic = m3.body.totales_por_mes[11]
  check('el total de diciembre cuenta la pagada', totalDic.pagadas >= 1, JSON.stringify(totalDic))
  check('el recaudado de diciembre suma el valor', totalDic.recaudado >= Number(dep.valor_mensualidad))

  console.log('\n--- Deportista sin valor de mensualidad ---')
  const { rows: sinValor } = await pool.query(
    `SELECT id, valor_mensualidad FROM tbd_deportista WHERE id_estado=1 AND id != $1 ORDER BY id LIMIT 1`, [dep.id])
  const otro = sinValor[0]
  const valorOriginal = otro.valor_mensualidad
  await pool.query('UPDATE tbd_deportista SET valor_mensualidad = 0 WHERE id = $1', [otro.id])
  const rechazo = await req('POST', '/api/mensualidades/marcar', { id_deportista: otro.id, mes: 3, año: AÑO, pagada: true }, token)
  check('se rechaza con mensaje claro si no tiene valor definido',
    rechazo.status === 409 && /valor de mensualidad/i.test(rechazo.body?.error || ''), JSON.stringify(rechazo.body))
  await pool.query('UPDATE tbd_deportista SET valor_mensualidad = $1 WHERE id = $2', [valorOriginal, otro.id])

  console.log('\n--- Permisos ---')
  const { rows: d3 } = await pool.query(
    `SELECT id, correo, numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=3 AND correo LIKE '%@ejemplo.com' ORDER BY id LIMIT 1`)
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [d3[0].id])
  const loginDep = await req('POST', '/api/auth/login-documento', { documento: d3[0].numero_documento, password: d3[0].numero_documento })
  const tokenDep = loginDep.body?.access_token
  check('un deportista NO puede ver la cartera completa del club',
    (await req('GET', `/api/mensualidades/anio/${AÑO}`, null, tokenDep)).status === 403)
  check('un deportista NO puede marcar mensualidades como pagadas',
    (await req('POST', '/api/mensualidades/marcar',
      { id_deportista: dep.id, mes: 4, año: AÑO, pagada: true }, tokenDep)).status === 403)
  check('un deportista sigue viendo su propio historial',
    (await req('GET', `/api/mensualidades/deportista/${dep.id}`, null, tokenDep)).status === 200)

  // Limpieza
  await pool.query('DELETE FROM tbd_mensualidad WHERE año = $1', [AÑO])
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = ANY($1)', [[a.id, d3[0].id]])
  const { rows: quedan } = await pool.query('SELECT COUNT(*)::int c FROM tbd_mensualidad WHERE año = $1', [AÑO])
  check('limpieza completa', quedan[0].c === 0)

  await pool.end()
  console.log(`\nRESULTADO: ${ok} pasan, ${fail} fallan`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })