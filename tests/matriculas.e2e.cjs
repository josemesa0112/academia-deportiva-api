/**
 * Prueba de punta a punta del marcado masivo de matrículas.
 * Trabaja sobre un año artificial y restaura el estado al terminar.
 *
 *   API_BASE=https://mi-api.onrender.com npm run test:matriculas
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

// Año artificial: no toca las matrículas reales.
const ANIO = 2033

;(async () => {
  const { rows: admins } = await pool.query(
    `SELECT id, correo, numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=1 AND correo LIKE '%@gmail.com' ORDER BY id LIMIT 1`)
  const a = admins[0]
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [a.id])
  const login = await req('POST', '/api/auth/login-documento',
    { documento: a.numero_documento, password: a.numero_documento })
  const token = login.body?.access_token
  if (!token) { console.log('No se pudo autenticar:', JSON.stringify(login.body)); process.exit(1) }

  await pool.query('DELETE FROM tbd_matricula WHERE EXTRACT(YEAR FROM fecha_inicio) = $1', [ANIO])

  // Deportistas a los que se les puede deducir un valor de matrícula.
  const { rows: elegibles } = await pool.query(`
    SELECT COUNT(*)::int c FROM tbd_deportista d
    WHERE d.id_estado = 1 AND d.id_categoria IS NOT NULL
      AND COALESCE(
        (SELECT m2.valor FROM tbd_matricula m2
          WHERE m2.id_categoria = d.id_categoria AND m2.valor > 0
          ORDER BY m2.fecha_inicio DESC LIMIT 1),
        d.valor_mensualidad, 0)::NUMERIC > 0`)
  const total = elegibles[0].c
  console.log(`Admin autenticado. ${total} deportistas con valor de matrícula deducible. Año ${ANIO}\n`)

  console.log('--- Acceso y validaciones ---')
  check('sin token da 401',
    (await req('POST', '/api/matriculas/marcar-anio', { año: ANIO, pagada: true })).status === 401)
  check('año inválido se rechaza',
    (await req('POST', '/api/matriculas/marcar-anio', { año: 1800, pagada: true }, token)).status === 400)
  check('pagada no booleana se rechaza',
    (await req('POST', '/api/matriculas/marcar-anio', { año: ANIO, pagada: 'si' }, token)).status === 400)

  console.log('\n--- Completa el registro para todos ---')
  const masivo = await req('POST', '/api/matriculas/marcar-anio', { año: ANIO, pagada: true }, token)
  check('marca el año completo', masivo.status === 200, JSON.stringify(masivo.body))
  check('crea las que faltaban', masivo.body?.creadas === total,
    `creadas=${masivo.body?.creadas} esperado=${total}`)
  check('todas quedan marcadas', masivo.body?.marcadas === total)

  const { rows: enBase } = await pool.query(
    `SELECT COUNT(*)::int total, COUNT(fecha_pago)::int pagadas,
            COUNT(*) FILTER (WHERE valor > 0)::int con_valor
       FROM tbd_matricula WHERE EXTRACT(YEAR FROM fecha_inicio) = $1`, [ANIO])
  check('quedaron en la base', enBase[0].total === total, JSON.stringify(enBase[0]))
  check('todas con fecha de pago', enBase[0].pagadas === total)
  check('ninguna quedó con valor cero', enBase[0].con_valor === total)

  console.log('\n--- Idempotencia ---')
  const repetir = await req('POST', '/api/matriculas/marcar-anio', { año: ANIO, pagada: true }, token)
  check('repetir no marca nada nuevo', repetir.body?.marcadas === 0, JSON.stringify(repetir.body))
  check('informa cuántas ya estaban', repetir.body?.ya_estaban === total)
  const { rows: dup } = await pool.query(
    `SELECT COUNT(*)::int c FROM (
       SELECT id_deportista FROM tbd_matricula
        WHERE EXTRACT(YEAR FROM fecha_inicio) = $1
        GROUP BY id_deportista HAVING COUNT(*) > 1) x`, [ANIO])
  check('no se duplicaron matrículas', dup[0].c === 0)

  // La fecha de las ya pagadas no debe pisarse en una segunda pasada.
  const { rows: dep } = await pool.query(
    `SELECT id_deportista, fecha_pago FROM tbd_matricula
      WHERE EXTRACT(YEAR FROM fecha_inicio) = $1 ORDER BY id LIMIT 1`, [ANIO])
  await new Promise(r => setTimeout(r, 1100))
  await req('POST', '/api/matriculas/marcar-anio', { año: ANIO, pagada: true }, token)
  const { rows: despues } = await pool.query(
    `SELECT fecha_pago FROM tbd_matricula
      WHERE EXTRACT(YEAR FROM fecha_inicio) = $1 AND id_deportista = $2`, [ANIO, dep[0].id_deportista])
  check('no pisa la fecha de las ya pagadas',
    new Date(dep[0].fecha_pago).getTime() === new Date(despues[0].fecha_pago).getTime())

  console.log('\n--- Reversión y alcance filtrado ---')
  const revertir = await req('POST', '/api/matriculas/marcar-anio', { año: ANIO, pagada: false }, token)
  check('revierte el año completo', revertir.body?.revertidas === total, JSON.stringify(revertir.body))
  const { rows: trasRevertir } = await pool.query(
    `SELECT COUNT(fecha_pago)::int pagadas, COUNT(*)::int total
       FROM tbd_matricula WHERE EXTRACT(YEAR FROM fecha_inicio) = $1`, [ANIO])
  check('quedan pendientes pero las filas siguen',
    trasRevertir[0].pagadas === 0 && trasRevertir[0].total === total)

  const { rows: algunos } = await pool.query(
    `SELECT DISTINCT id_deportista FROM tbd_matricula
      WHERE EXTRACT(YEAR FROM fecha_inicio) = $1 ORDER BY id_deportista LIMIT 3`, [ANIO])
  const ids = algunos.map(r => r.id_deportista)
  const acotado = await req('POST', '/api/matriculas/marcar-anio',
    { año: ANIO, pagada: true, ids_deportistas: ids }, token)
  check('respeta el alcance filtrado', acotado.body?.marcadas === ids.length, JSON.stringify(acotado.body))
  const { rows: soloEsos } = await pool.query(
    `SELECT COUNT(fecha_pago)::int pagadas FROM tbd_matricula
      WHERE EXTRACT(YEAR FROM fecha_inicio) = $1`, [ANIO])
  check('solo esos quedaron pagados', soloEsos[0].pagadas === ids.length)

  console.log('\n--- Permisos ---')
  const { rows: d3 } = await pool.query(
    `SELECT id, numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=3 AND correo LIKE '%@ejemplo.com' ORDER BY id LIMIT 1`)
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [d3[0].id])
  const loginDep = await req('POST', '/api/auth/login-documento',
    { documento: d3[0].numero_documento, password: d3[0].numero_documento })
  const tokenDep = loginDep.body?.access_token
  check('un deportista NO puede marcar el año completo',
    (await req('POST', '/api/matriculas/marcar-anio', { año: ANIO, pagada: true }, tokenDep)).status === 403)

  // Limpieza
  await pool.query('DELETE FROM tbd_matricula WHERE EXTRACT(YEAR FROM fecha_inicio) = $1', [ANIO])
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = ANY($1)', [[a.id, d3[0].id]])
  const { rows: quedan } = await pool.query(
    `SELECT COUNT(*)::int c FROM tbd_matricula WHERE EXTRACT(YEAR FROM fecha_inicio) = $1`, [ANIO])
  check('limpieza completa', quedan[0].c === 0)

  await pool.end()
  console.log(`\nRESULTADO: ${ok} pasan, ${fail} fallan`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
