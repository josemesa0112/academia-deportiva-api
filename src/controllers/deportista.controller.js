const pool = require('../db')
const q = require('../queries/deportista.queries')

// Convierte "1,2,3" o [1,2,3] o "1, 2" en [1, 2, 3]
const parsePosiciones = (val) => {
  if (val === null || val === undefined || val === '') return []
  const arr = Array.isArray(val) ? val : String(val).split(',')
  return arr
    .map(v => Number(String(v).trim()))
    .filter(n => Number.isInteger(n) && n > 0)
}

// Compara dos snapshots de medidas y retorna true si alguna cambió
const medidasCambiaron = (prev, next) => {
  const keys = ['peso_actual', 'estatura_actual', 'imc_actual', 'porcentaje_grasa_actual']
  return keys.some(k => {
    const a = prev[k]
    const b = next[k]
    if (a === null || a === undefined) return b !== null && b !== undefined && b !== ''
    if (b === null || b === undefined || b === '') return true
    return Number(a) !== Number(b)
  })
}

// Inserta una fila en tbd_medicion usando los valores que vienen en el body
const insertMedicion = (client, id_deportista, body) => client.query(`
  INSERT INTO tbd_medicion (id_deportista, peso, estatura, imc, porcentaje_grasa, fecha)
  VALUES ($1, $2, $3, $4, $5, NOW())
`, [
  id_deportista,
  body.peso_actual || null,
  body.estatura_actual || null,
  body.IMC_actual || null,
  body.porcentaje_grasa_actual || null,
])

// Sincroniza la tabla M:N: borra las posiciones que ya no están, inserta las nuevas
const syncPosiciones = async (client, id_deportista, posiciones) => {
  if (posiciones.length === 0) {
    await client.query('DELETE FROM tbd_deportista_x_posicion WHERE id_deportista = $1', [id_deportista])
    return
  }
  // Borra las que ya no están
  await client.query(
    `DELETE FROM tbd_deportista_x_posicion
     WHERE id_deportista = $1 AND id_posicion NOT IN (${posiciones.map((_, i) => `$${i + 2}`).join(',')})`,
    [id_deportista, ...posiciones]
  )
  // Inserta las nuevas (ignora duplicados gracias a UNIQUE)
  for (const id_posicion of posiciones) {
    await client.query(
      `INSERT INTO tbd_deportista_x_posicion (id_deportista, id_posicion)
       VALUES ($1, $2)
       ON CONFLICT (id_deportista, id_posicion) DO NOTHING`,
      [id_deportista, id_posicion]
    )
  }
}

const getDeportistas = async (req, res) => {
  try {
    const { rows } = await q.getDeportistas()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getDeportistaById = async (req, res) => {
  try {
    const { rows } = await q.getDeportistaById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Deportista no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createDeportista = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await q.createDeportistaRow(req.body, client)
    const deportista = rows[0]

    const posiciones = parsePosiciones(req.body.posiciones)
    if (posiciones.length > 0) {
      await syncPosiciones(client, deportista.id, posiciones)
    }

    // Medición inicial: registra el estado físico al momento de crear
    await insertMedicion(client, deportista.id, req.body)

    await client.query('COMMIT')
    res.status(201).json(deportista)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

const updateDeportista = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Snapshot anterior para detectar cambios en medidas
    const { rows: snapshotRows } = await q.getDeportistaSnapshot(req.params.id, client)
    if (!snapshotRows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Deportista no encontrado' })
    }
    const previas = snapshotRows[0]

    const { rows } = await q.updateDeportistaRow(req.params.id, req.body, client)
    const deportista = rows[0]

    // Sincroniza posiciones (incluso si vienen vacías, refleja la intención del usuario)
    if (req.body.posiciones !== undefined) {
      await syncPosiciones(client, deportista.id, parsePosiciones(req.body.posiciones))
    }

    // Si alguna medida cambió, registra nueva fila en el historial
    if (medidasCambiaron(previas, req.body)) {
      await insertMedicion(client, deportista.id, req.body)
    }

    await client.query('COMMIT')
    res.json(deportista)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

const deleteDeportista = async (req, res) => {
  try {
    const { rows } = await q.deleteDeportista(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Deportista no encontrado' })
    res.json({ message: 'Deportista desactivado correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getDeportistasByCategoria = async (req, res) => {
  try {
    const { rows } = await q.getDeportistasByCategoria(req.params.id_categoria)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getDeportistas,
  getDeportistaById,
  createDeportista,
  updateDeportista,
  deleteDeportista,
  getDeportistasByCategoria,
}
