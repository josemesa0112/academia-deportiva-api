/**
 * Prueba de punta a punta de los gastos del club.
 * Crea, edita y anula un gasto real, y verifica que el dashboard lo refleje.
 * Al terminar borra físicamente el gasto de prueba.
 *
 *   API_BASE=https://mi-api.onrender.com npm run test:gastos
 */
const { Pool } = require('pg')
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true })
const { admin, buscarUsuarioPorCorreo } = require('../src/lib/supabaseAdmin')

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

const hoy = new Date()
const FECHA_HOY = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

;(async () => {
  // Token de admin
  const { rows: admins } = await pool.query(
    `SELECT id, correo, numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=1 AND correo LIKE '%@gmail.com' ORDER BY id LIMIT 1`)
  const a = admins[0]
  const existiaAuth = Boolean(await buscarUsuarioPorCorreo(a.correo))
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [a.id])
  const login = await req('POST', '/api/auth/login-documento', { documento: a.numero_documento, password: a.numero_documento })
  const token = login.body?.access_token
  if (!token) { console.log('No se pudo autenticar:', JSON.stringify(login.body)); process.exit(1) }
  console.log(`Autenticado como admin (${a.correo})\n`)

  console.log('--- Acceso ---')
  check('sin token da 401', (await req('GET', '/api/gastos')).status === 401)
  check('el catálogo de tipos responde', (await req('GET', '/api/catalogos/tipos-gasto')).status === 200)
  const tipos = (await req('GET', '/api/catalogos/tipos-gasto')).body
  const idArriendo = tipos.find(t => t.nombre === 'Arriendo')?.id
  check('existe el tipo Arriendo', Boolean(idArriendo))

  console.log('\n--- Validaciones ---')
  const sinConcepto = await req('POST', '/api/gastos', { id_tipo_gasto: idArriendo, valor: 1000, fecha: FECHA_HOY }, token)
  check('rechaza gasto sin concepto', sinConcepto.status === 400, JSON.stringify(sinConcepto.body))
  const valorCero = await req('POST', '/api/gastos', { concepto: 'X', id_tipo_gasto: idArriendo, valor: 0, fecha: FECHA_HOY }, token)
  check('rechaza valor cero', valorCero.status === 400)
  const valorNeg = await req('POST', '/api/gastos', { concepto: 'X', id_tipo_gasto: idArriendo, valor: -5000, fecha: FECHA_HOY }, token)
  check('rechaza valor negativo', valorNeg.status === 400)
  const sinFecha = await req('POST', '/api/gastos', { concepto: 'X', id_tipo_gasto: idArriendo, valor: 1000 }, token)
  check('rechaza gasto sin fecha', sinFecha.status === 400)

  console.log('\n--- Efecto en el dashboard ---')
  const antes = (await req('GET', '/api/dashboard/resumen', null, token)).body.financiero
  check('el dashboard trae el desglose nuevo',
    antes.gastos_operativos !== undefined && antes.gastos_compras !== undefined && Array.isArray(antes.gastos_por_tipo),
    JSON.stringify(Object.keys(antes)))

  const VALOR = 777777
  const creado = await req('POST', '/api/gastos', {
    concepto: 'PRUEBA automatizada arriendo', id_tipo_gasto: idArriendo,
    valor: VALOR, fecha: FECHA_HOY, descripcion: 'gasto de prueba',
  }, token)
  check('crea el gasto', creado.status === 201, JSON.stringify(creado.body))
  const idGasto = creado.body?.id

  const creadoSinDetalle = await req('POST', '/api/gastos', {
    concepto: 'PRUEBA sin detalle', id_tipo_gasto: idArriendo, valor: 1000, fecha: FECHA_HOY,
  }, token)
  check('el detalle es opcional', creadoSinDetalle.status === 201, JSON.stringify(creadoSinDetalle.body))
  const idGasto2 = creadoSinDetalle.body?.id

  const despues = (await req('GET', '/api/dashboard/resumen', null, token)).body.financiero
  check('los gastos operativos suben en el valor creado',
    Math.round(despues.gastos_operativos - antes.gastos_operativos) === VALOR + 1000,
    `antes=${antes.gastos_operativos} despues=${despues.gastos_operativos}`)
  check('el total de gastos también sube',
    Math.round(despues.gastos - antes.gastos) === VALOR + 1000)
  check('las compras no se ven afectadas', despues.gastos_compras === antes.gastos_compras)
  check('aparece en el desglose por tipo',
    despues.gastos_por_tipo.some(t => t.tipo === 'Arriendo' && t.total >= VALOR),
    JSON.stringify(despues.gastos_por_tipo))
  check('el balance del mes descuenta los gastos',
    Math.round(despues.balance_mes) === Math.round(despues.recaudo_mes - despues.gastos))

  console.log('\n--- Listado y edición ---')
  const lista = await req('GET', '/api/gastos', null, token)
  check('el gasto aparece en el listado', lista.body.some(g => g.id === idGasto))
  check('el listado trae el nombre del tipo', lista.body.find(g => g.id === idGasto)?.tipo_gasto === 'Arriendo')

  const editado = await req('PUT', `/api/gastos/${idGasto}`, {
    concepto: 'PRUEBA editada', id_tipo_gasto: idArriendo, valor: 500, fecha: FECHA_HOY,
  }, token)
  check('edita el gasto', editado.status === 200 && Number(editado.body.valor) === 500, JSON.stringify(editado.body))

  console.log('\n--- Anulación (soft delete) ---')
  const anulado = await req('DELETE', `/api/gastos/${idGasto}`, null, token)
  check('anula el gasto', anulado.status === 200)
  const listaTrasAnular = await req('GET', '/api/gastos', null, token)
  check('el anulado desaparece del listado', !listaTrasAnular.body.some(g => g.id === idGasto))
  const { rows: sigueEnBase } = await pool.query('SELECT id_estado FROM tbd_gasto WHERE id = $1', [idGasto])
  check('pero sigue en la base con estado 2', sigueEnBase[0]?.id_estado === 2)
  const trasAnular = (await req('GET', '/api/dashboard/resumen', null, token)).body.financiero
  check('el anulado deja de sumar en el dashboard',
    Math.round(trasAnular.gastos_operativos - antes.gastos_operativos) === 1000,
    `esperado +1000, real ${trasAnular.gastos_operativos - antes.gastos_operativos}`)

  console.log('\n--- Permisos por rol ---')
  const { rows: deps } = await pool.query(
    `SELECT id, correo, numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=3 AND correo LIKE '%@ejemplo.com' ORDER BY id LIMIT 1`)
  const d = deps[0]
  const existiaAuthDep = Boolean(await buscarUsuarioPorCorreo(d.correo))
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [d.id])
  const loginDep = await req('POST', '/api/auth/login-documento', { documento: d.numero_documento, password: d.numero_documento })
  const tokenDep = loginDep.body?.access_token
  check('un deportista NO puede ver los gastos', (await req('GET', '/api/gastos', null, tokenDep)).status === 403)
  check('un deportista NO puede crear gastos',
    (await req('POST', '/api/gastos', { concepto: 'X', id_tipo_gasto: idArriendo, valor: 1, fecha: FECHA_HOY }, tokenDep)).status === 403)

  // Limpieza
  await pool.query('DELETE FROM tbd_gasto WHERE id = ANY($1)', [[idGasto, idGasto2].filter(Boolean)])
  await pool.query('DELETE FROM tbd_gasto WHERE concepto LIKE $1', ['PRUEBA%'])
  if (!existiaAuthDep) {
    const u = await buscarUsuarioPorCorreo(d.correo)
    if (u) await admin.auth.admin.deleteUser(u.id)
  }
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = ANY($1)', [[a.id, d.id]])
  if (!existiaAuth) { /* la cuenta del admin no existía; se deja como estaba */ }

  const final = (await req('GET', '/api/dashboard/resumen', null, token)).body.financiero
  check('tras la limpieza el dashboard vuelve al valor inicial',
    Math.round(final.gastos_operativos) === Math.round(antes.gastos_operativos),
    `inicial=${antes.gastos_operativos} final=${final.gastos_operativos}`)

  await pool.end()
  console.log(`\nRESULTADO: ${ok} pasan, ${fail} fallan`)
  console.log('Limpieza hecha: gastos de prueba eliminados.')
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })