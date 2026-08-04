/**
 * Prueba de punta a punta del flujo de autenticación contra el API local.
 * Usa una persona real de la base, y al final DESHACE todo:
 * borra la cuenta de Auth creada y restaura debe_cambiar_password.
 */
const { Pool } = require('pg')
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true })
const { admin, buscarUsuarioPorCorreo } = require('../src/lib/supabaseAdmin')

const BASE = 'http://localhost:3000'
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

let ok = 0, fail = 0
const check = (nombre, condicion, detalle = '') => {
  if (condicion) { ok++; console.log('  PASA  ' + nombre) }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')) }
}

const req = async (metodo, ruta, body, token) => {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch { /* sin cuerpo */ }
  return { status: res.status, body: json }
}

;(async () => {
  // Persona de prueba: deportista activo con correo ficticio (no toca cuentas reales).
  const { rows } = await pool.query(
    `SELECT id, nombre, correo, numero_documento FROM tbd_persona
      WHERE id_estado = 1 AND id_rol = 3 AND correo LIKE '%@ejemplo.com'
      ORDER BY id LIMIT 1`)
  const p = rows[0]
  if (!p) throw new Error('No hay persona de prueba disponible')
  console.log(`Persona de prueba: id=${p.id} doc=${p.numero_documento} correo=${p.correo}\n`)

  const previo = await buscarUsuarioPorCorreo(p.correo)
  if (previo) { console.log('  (ya existía cuenta de Auth; se elimina para probar el primer ingreso)'); await admin.auth.admin.deleteUser(previo.id) }
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [p.id])

  console.log('--- Endpoints protegidos ---')
  check('GET /api/personas sin token da 401', (await req('GET', '/api/personas')).status === 401)
  check('GET /api/dashboard/resumen sin token da 401', (await req('GET', '/api/dashboard/resumen')).status === 401)
  check('GET /api/catalogos/categorias sigue público', (await req('GET', '/api/catalogos/categorias')).status === 200)
  check('GET /health sigue público', (await req('GET', '/health')).status === 200)

  console.log('\n--- Primer ingreso (contraseña = documento) ---')
  const malo = await req('POST', '/api/auth/login-documento', { documento: p.numero_documento, password: 'otracosa' })
  check('contraseña incorrecta da 401', malo.status === 401, JSON.stringify(malo.body))
  check('mensaje no revela si el documento existe', malo.body?.error === 'Documento o contraseña incorrectos.')

  const inexistente = await req('POST', '/api/auth/login-documento', { documento: '000000000000', password: '000000000000' })
  check('documento inexistente da el mismo mensaje', inexistente.status === 401 && inexistente.body?.error === 'Documento o contraseña incorrectos.')

  const primero = await req('POST', '/api/auth/login-documento', { documento: p.numero_documento, password: p.numero_documento })
  check('primer ingreso con el documento funciona', primero.status === 200, JSON.stringify(primero.body))
  check('devuelve access_token', Boolean(primero.body?.access_token))
  check('avisa que debe cambiar la contraseña', primero.body?.debe_cambiar_password === true)
  const token = primero.body?.access_token

  console.log('\n--- Token válido en endpoints protegidos ---')
  const personas = await req('GET', '/api/personas', null, token)
  check('GET /api/personas con token da 200', personas.status === 200)
  const yo = await req('GET', '/api/auth/yo', null, token)
  check('GET /api/auth/yo devuelve la persona correcta', yo.body?.id === p.id, JSON.stringify(yo.body))

  const ajeno = await req('GET', '/api/personas/correo/josemesaenero8@gmail.com', null, token)
  check('un deportista no puede consultar el correo de otro (403)', ajeno.status === 403, JSON.stringify(ajeno.body))
  const propio = await req('GET', '/api/personas/correo/' + p.correo, null, token)
  check('sí puede consultar el suyo', propio.status === 200)

  console.log('\n--- Cambio de contraseña ---')
  const corta = await req('POST', '/api/auth/cambiar-password', { password_actual: p.numero_documento, password_nueva: '123' }, token)
  check('rechaza contraseña de menos de 6 caracteres', corta.status === 400)
  const igualDoc = await req('POST', '/api/auth/cambiar-password', { password_actual: p.numero_documento, password_nueva: p.numero_documento }, token)
  check('rechaza usar el documento como contraseña', igualDoc.status === 400)
  const actualMala = await req('POST', '/api/auth/cambiar-password', { password_actual: 'noesesta', password_nueva: 'ClaveNueva123' }, token)
  check('rechaza si la contraseña actual es incorrecta', actualMala.status === 401)

  const cambio = await req('POST', '/api/auth/cambiar-password', { password_actual: p.numero_documento, password_nueva: 'ClaveNueva123' }, token)
  check('cambia la contraseña', cambio.status === 200, JSON.stringify(cambio.body))

  const conVieja = await req('POST', '/api/auth/login-documento', { documento: p.numero_documento, password: p.numero_documento })
  check('la contraseña vieja ya no sirve', conVieja.status === 401)

  // Regresión: con la contraseña ya definida, entrar con el documento no debe
  // reescribirla. De lo contrario cualquiera que conozca un documento podría
  // apoderarse de la cuenta.
  const { rows: verif } = await pool.query('SELECT debe_cambiar_password FROM tbd_persona WHERE id = $1', [p.id])
  check('el documento NO reescribe una contraseña ya definida', verif[0].debe_cambiar_password === false)
  const reintento = await req('POST', '/api/auth/login-documento', { documento: p.numero_documento, password: 'ClaveNueva123' })
  check('la contraseña definida sigue siendo válida tras el intento', reintento.status === 200)
  const conNueva = await req('POST', '/api/auth/login-documento', { documento: p.numero_documento, password: 'ClaveNueva123' })
  check('la contraseña nueva sirve', conNueva.status === 200, JSON.stringify(conNueva.body))
  check('ya no pide cambiar la contraseña', conNueva.body?.debe_cambiar_password === false)

  console.log('\n--- Recuperación con código ---')
  const solicitud = await req('POST', '/api/auth/recuperar/solicitar', { documento: p.numero_documento })
  check('solicitar código responde 200', solicitud.status === 200, JSON.stringify(solicitud.body))
  const fantasma = await req('POST', '/api/auth/recuperar/solicitar', { documento: '000000000000' })
  check('documento inexistente responde igual (no revela nada)', fantasma.status === 200 && fantasma.body?.mensaje === solicitud.body?.mensaje)

  const { rows: cod } = await pool.query(
    `SELECT id FROM tbd_codigo_verificacion WHERE id_persona = $1 AND usado_en IS NULL ORDER BY creado_en DESC LIMIT 1`, [p.id])
  check('el código quedó guardado en la base', cod.length === 1)

  const malCodigo = await req('POST', '/api/auth/recuperar/verificar', { documento: p.numero_documento, codigo: '000000', password_nueva: 'OtraClave456' })
  check('código incorrecto es rechazado', malCodigo.status === 400, JSON.stringify(malCodigo.body))
  const { rows: tras } = await pool.query('SELECT intentos FROM tbd_codigo_verificacion WHERE id = $1', [cod[0].id])
  check('cuenta el intento fallido', tras[0]?.intentos === 1, 'intentos=' + tras[0]?.intentos)

  // Se fija un código conocido (con el mismo hasheo del servidor) para probar
  // el camino exitoso sin depender del canal de envío.
  const { hashearCodigo } = require('../src/lib/codigos')
  await pool.query(
    'UPDATE tbd_codigo_verificacion SET codigo_hash = $1, intentos = 0 WHERE id = $2',
    [hashearCodigo('654321'), cod[0].id])

  const cortaReset = await req('POST', '/api/auth/recuperar/verificar', { documento: p.numero_documento, codigo: '654321', password_nueva: 'abc' })
  check('rechaza contraseña corta al restablecer', cortaReset.status === 400)

  const reset = await req('POST', '/api/auth/recuperar/verificar', { documento: p.numero_documento, codigo: '654321', password_nueva: 'Restablecida789' })
  check('restablece con el código correcto', reset.status === 200, JSON.stringify(reset.body))

  const loginTrasReset = await req('POST', '/api/auth/login-documento', { documento: p.numero_documento, password: 'Restablecida789' })
  check('se puede entrar con la contraseña restablecida', loginTrasReset.status === 200)

  const reusar = await req('POST', '/api/auth/recuperar/verificar', { documento: p.numero_documento, codigo: '654321', password_nueva: 'OtraMas999' })
  check('el código no se puede reutilizar', reusar.status === 400, JSON.stringify(reusar.body))

  await pool.end()
  console.log(`\nRESULTADO: ${ok} pasan, ${fail} fallan`)

  // Limpieza: dejar la persona y Auth como estaban.
  const creado = await buscarUsuarioPorCorreo(p.correo)
  if (creado) await admin.auth.admin.deleteUser(creado.id)
  const pool2 = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pool2.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [p.id])
  await pool2.query('DELETE FROM tbd_codigo_verificacion WHERE id_persona = $1', [p.id])
  await pool2.end()
  console.log('Limpieza hecha: cuenta de Auth y códigos de prueba eliminados.')

  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })