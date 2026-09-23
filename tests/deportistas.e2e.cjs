/**
 * Prueba de punta a punta de la creación de deportistas con datos físicos
 * opcionales. Crea registros reales y los elimina al terminar.
 *
 *   API_BASE=https://mi-api.onrender.com npm run test:deportistas
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

// Las personas de prueba llevan este documento para poder limpiarlas.
const DOC_PRUEBA = '99999900'

;(async () => {
  const creados = { personas: [], deportistas: [] }

  const limpiar = async () => {
    await pool.query(
      `DELETE FROM tbd_medicion WHERE id_deportista IN (
         SELECT d.id FROM tbd_deportista d JOIN tbd_persona p ON p.id = d.id_persona
          WHERE p.numero_documento LIKE $1)`, [DOC_PRUEBA + '%'])
    await pool.query(
      `DELETE FROM tbd_deportista WHERE id_persona IN (
         SELECT id FROM tbd_persona WHERE numero_documento LIKE $1)`, [DOC_PRUEBA + '%'])
    await pool.query('DELETE FROM tbd_persona WHERE numero_documento LIKE $1', [DOC_PRUEBA + '%'])
  }
  await limpiar()

  const { rows: admins } = await pool.query(
    `SELECT id, numero_documento FROM tbd_persona
      WHERE id_estado=1 AND id_rol=1 AND correo LIKE '%@gmail.com' ORDER BY id LIMIT 1`)
  await pool.query('UPDATE tbd_persona SET debe_cambiar_password = TRUE WHERE id = $1', [admins[0].id])
  const doc = admins[0].numero_documento
  const login = await req('POST', '/api/auth/login-documento', { documento: doc, password: doc })
  const token = login.body?.access_token
  if (!token) { console.log('No se pudo autenticar:', JSON.stringify(login.body)); process.exit(1) }

  const { rows: cats } = await pool.query('SELECT id FROM tbd_categoria ORDER BY id LIMIT 1')
  const idCategoria = cats[0].id

  // Persona con rol Deportista para poder crear su ficha.
  const crearPersona = async (sufijo) => {
    const r = await req('POST', '/api/personas', {
      // El apellido solo admite letras: el sufijo va en documento y correo.
      nombre: 'PRUEBA', apellido: 'Fisico',
      correo: `prueba.fisico${sufijo}@ejemplo.com`,
      numero_documento: DOC_PRUEBA + sufijo,
      numero_telefono: '3000000000',
      id_rol: 3, id_tipo_documento: 1, id_genero: 1, id_estado: 1,
      fecha_nacimiento: '2012-01-01', es_empresa: false,
    }, token)
    return r
  }

  console.log('Autenticado como admin.\n')

  console.log('--- El catálogo de clasificación es el de IMC ---')
  const { rows: catalogo } = await pool.query(
    'SELECT id, nombre FROM tbd_clasificacion ORDER BY id')
  const nombres = catalogo.map(c => c.nombre).join(' | ')
  check('el catálogo tiene las tres categorías de IMC',
    nombres === 'Bajo en grasa | Saludable | Sobrepeso', 'catálogo=' + nombres)
  const { rows: incoherentes } = await pool.query(`
    SELECT COUNT(*)::int c FROM tbd_deportista
     WHERE imc_actual IS NOT NULL
       AND id_clasificacion IS DISTINCT FROM (CASE
         WHEN imc_actual < 18.5 THEN 1 WHEN imc_actual < 25 THEN 2 ELSE 3 END)`)
  check('ningún deportista quedó con clasificación incoherente',
    incoherentes[0].c === 0, 'incoherentes=' + incoherentes[0].c)

  console.log('--- Crear deportista SIN datos físicos ---')
  const p1 = await crearPersona('1')
  check('se crea la persona de prueba', p1.status === 201, JSON.stringify(p1.body))
  creados.personas.push(p1.body?.id)

  const sinFisico = await req('POST', '/api/deportistas', {
    id_persona: p1.body.id,
    id_categoria: idCategoria,
    id_estado: 1,
    valor_mensualidad: 100000,
  }, token)
  check('crea el deportista sin peso ni estatura', sinFisico.status === 201, JSON.stringify(sinFisico.body))
  const idDep1 = sinFisico.body?.id
  creados.deportistas.push(idDep1)

  const { rows: fila1 } = await pool.query(
    'SELECT peso_actual, estatura_actual, imc_actual, id_clasificacion FROM tbd_deportista WHERE id = $1',
    [idDep1])
  check('el peso queda en null', fila1[0]?.peso_actual === null, 'peso=' + fila1[0]?.peso_actual)
  check('la estatura queda en null', fila1[0]?.estatura_actual === null)
  check('el IMC queda en null, no en cero', fila1[0]?.imc_actual === null,
    'imc=' + fila1[0]?.imc_actual)
  check('no se asigna clasificación', fila1[0]?.id_clasificacion === null)

  const { rows: med1 } = await pool.query(
    'SELECT COUNT(*)::int c FROM tbd_medicion WHERE id_deportista = $1', [idDep1])
  check('no se crea una medición vacía', med1[0].c === 0, 'mediciones=' + med1[0].c)

  console.log('\n--- Crear deportista CON datos físicos ---')
  const p2 = await crearPersona('2')
  creados.personas.push(p2.body?.id)
  const conFisico = await req('POST', '/api/deportistas', {
    id_persona: p2.body.id,
    id_categoria: idCategoria,
    id_estado: 1,
    valor_mensualidad: 100000,
    peso_actual: 60,
    estatura_actual: 1.7,
  }, token)
  check('crea el deportista con medidas', conFisico.status === 201, JSON.stringify(conFisico.body))
  const idDep2 = conFisico.body?.id
  creados.deportistas.push(idDep2)

  const { rows: fila2 } = await pool.query(
    'SELECT peso_actual, estatura_actual, imc_actual, id_clasificacion FROM tbd_deportista WHERE id = $1',
    [idDep2])
  check('el IMC se calcula solo', Math.abs(Number(fila2[0]?.imc_actual) - 20.76) < 0.1,
    'imc=' + fila2[0]?.imc_actual)
  // IMC 20.76 cae en el rango saludable (18.5 a 24.9).
  check('se asigna la clasificación automática', fila2[0]?.id_clasificacion !== null,
    'id_clasificacion=' + fila2[0]?.id_clasificacion)
  const { rows: nombreClas } = await pool.query(
    'SELECT nombre FROM tbd_clasificacion WHERE id = $1', [fila2[0]?.id_clasificacion])
  check('y es la correcta para ese IMC', nombreClas[0]?.nombre === 'Saludable',
    'clasificacion=' + nombreClas[0]?.nombre)
  const { rows: med2 } = await pool.query(
    'SELECT COUNT(*)::int c FROM tbd_medicion WHERE id_deportista = $1', [idDep2])
  check('sí se registra la medición inicial', med2[0].c === 1)

  console.log('\n--- Completar el físico después ---')
  const completar = await req('PUT', `/api/deportistas/${idDep1}`, {
    id_persona: p1.body.id,
    id_categoria: idCategoria,
    id_estado: 1,
    valor_mensualidad: 100000,
    peso_actual: 50,
    estatura_actual: 1.6,
  }, token)
  check('se pueden agregar las medidas más tarde', completar.status === 200, JSON.stringify(completar.body))
  const { rows: fila3 } = await pool.query(
    'SELECT peso_actual, imc_actual FROM tbd_deportista WHERE id = $1', [idDep1])
  check('el peso queda registrado', Number(fila3[0]?.peso_actual) === 50)
  check('y el IMC se calcula en ese momento',
    Math.abs(Number(fila3[0]?.imc_actual) - 19.53) < 0.1, 'imc=' + fila3[0]?.imc_actual)
  const { rows: med3 } = await pool.query(
    'SELECT COUNT(*)::int c FROM tbd_medicion WHERE id_deportista = $1', [idDep1])
  check('ahora sí queda una medición', med3[0].c === 1)

  console.log('\n--- Los tres tramos de IMC ---')
  const tramos = [
    { peso: 40, estatura: 1.75, esperado: 'Bajo en grasa' },  // IMC 13.1
    { peso: 60, estatura: 1.70, esperado: 'Saludable' },      // IMC 20.8
    { peso: 95, estatura: 1.70, esperado: 'Sobrepeso' },      // IMC 32.9
  ]
  for (const t of tramos) {
    const r = await req('PUT', `/api/deportistas/${idDep2}`, {
      id_persona: p2.body.id, id_categoria: idCategoria, id_estado: 1,
      peso_actual: t.peso, estatura_actual: t.estatura,
    }, token)
    const { rows: cl } = await pool.query(
      `SELECT c.nombre FROM tbd_deportista d
         JOIN tbd_clasificacion c ON c.id = d.id_clasificacion
        WHERE d.id = $1`, [idDep2])
    check(`peso ${t.peso} y estatura ${t.estatura} -> ${t.esperado}`,
      r.status === 200 && cl[0]?.nombre === t.esperado,
      'recibido=' + cl[0]?.nombre)
  }

  console.log('\n--- Lo que sigue siendo obligatorio ---')
  const p3 = await crearPersona('3')
  creados.personas.push(p3.body?.id)
  const sinCategoria = await req('POST', '/api/deportistas', {
    id_persona: p3.body.id, id_estado: 1,
  }, token)
  check('la categoría sigue siendo obligatoria', sinCategoria.status === 400,
    JSON.stringify(sinCategoria.body))
  const sinPersona = await req('POST', '/api/deportistas', {
    id_categoria: idCategoria, id_estado: 1,
  }, token)
  check('la persona sigue siendo obligatoria', sinPersona.status === 400)

  console.log('\n--- Validación de los valores cuando sí se envían ---')
  const pesoTexto = await req('POST', '/api/deportistas', {
    id_persona: p3.body.id, id_categoria: idCategoria, id_estado: 1, peso_actual: 'mucho',
  }, token)
  check('rechaza un peso no numérico', pesoTexto.status === 400, JSON.stringify(pesoTexto.body))
  // Un 0 se trata como ausencia de dato, no como un peso real.
  const pesoCero = await req('POST', '/api/deportistas', {
    id_persona: p3.body.id, id_categoria: idCategoria, id_estado: 1, peso_actual: 0, estatura_actual: 1.6,
  }, token)
  check('acepta un peso en cero como dato ausente', pesoCero.status === 201,
    JSON.stringify(pesoCero.body))
  if (pesoCero.body?.id) {
    const { rows: cero } = await pool.query(
      'SELECT peso_actual, imc_actual FROM tbd_deportista WHERE id = $1', [pesoCero.body.id])
    check('y lo guarda como null, no como cero', cero[0]?.peso_actual === null,
      'peso=' + cero[0]?.peso_actual)
    check('sin peso no calcula IMC', cero[0]?.imc_actual === null)
  }

  // Limpieza
  await limpiar()
  const { rows: quedan } = await pool.query(
    'SELECT COUNT(*)::int c FROM tbd_persona WHERE numero_documento LIKE $1', [DOC_PRUEBA + '%'])
  check('limpieza completa', quedan[0].c === 0)

  await pool.end()
  console.log(`\nRESULTADO: ${ok} pasan, ${fail} fallan`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
