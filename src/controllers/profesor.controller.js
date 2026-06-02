const pool = require('../db')
const q = require('../queries/profesor.queries')

// Traduce errores de PostgreSQL a respuestas HTTP claras
const handleDbError = (err, res) => {
  if (err.code === '23505' && err.constraint === 'uniq_profesor_id_persona') {
    return res.status(409).json({ error: 'Esta persona ya está registrada como profesor' })
  }
  return res.status(500).json({ error: err.message })
}

// Convierte "1,2,3" o [1,2,3] a [1, 2, 3]
const parseCategorias = (val) => {
  if (val === null || val === undefined || val === '') return []
  const arr = Array.isArray(val) ? val : String(val).split(',')
  return arr
    .map(v => Number(String(v).trim()))
    .filter(n => Number.isInteger(n) && n > 0)
}

// Sincroniza la tabla M:N: borra las que ya no están, inserta las nuevas.
const syncCategorias = async (client, id_profesor, categorias) => {
  if (categorias.length === 0) {
    await client.query('DELETE FROM tbd_profesor_x_categoria WHERE id_profesor = $1', [id_profesor])
    return
  }
  await client.query(
    `DELETE FROM tbd_profesor_x_categoria
     WHERE id_profesor = $1 AND id_categoria NOT IN (${categorias.map((_, i) => `$${i + 2}`).join(',')})`,
    [id_profesor, ...categorias]
  )
  for (const id_categoria of categorias) {
    await client.query(
      `INSERT INTO tbd_profesor_x_categoria (id_profesor, id_categoria)
       VALUES ($1, $2)
       ON CONFLICT (id_profesor, id_categoria) DO NOTHING`,
      [id_profesor, id_categoria]
    )
  }
}

const getProfesores = async (req, res) => {
  try {
    const { rows } = await q.getProfesores()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getProfesorById = async (req, res) => {
  try {
    const { rows } = await q.getProfesorById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Profesor no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getCategoriasDelProfesor = async (req, res) => {
  try {
    const { rows } = await q.getCategoriasByProfesor(req.params.id)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createProfesor = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await q.createProfesorRow(req.body, client)
    const profesor = rows[0]

    const categorias = parseCategorias(req.body.categorias)
    if (categorias.length > 0) {
      await syncCategorias(client, profesor.id, categorias)
    }

    await client.query('COMMIT')
    res.status(201).json(profesor)
  } catch (err) {
    await client.query('ROLLBACK')
    handleDbError(err, res)
  } finally {
    client.release()
  }
}

const updateProfesor = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await q.updateProfesorRow(req.params.id, req.body, client)
    if (!rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Profesor no encontrado' })
    }
    const profesor = rows[0]

    // Si vinieron categorias en el body, sincronizar. Si no, no se toca la relación.
    if (req.body.categorias !== undefined) {
      await syncCategorias(client, profesor.id, parseCategorias(req.body.categorias))
    }

    await client.query('COMMIT')
    res.json(profesor)
  } catch (err) {
    await client.query('ROLLBACK')
    handleDbError(err, res)
  } finally {
    client.release()
  }
}

const deleteProfesor = async (req, res) => {
  try {
    const { rows } = await q.deleteProfesor(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Profesor no encontrado' })
    res.json({ message: 'Profesor desactivado correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getProfesores,
  getProfesorById,
  getCategoriasDelProfesor,
  createProfesor,
  updateProfesor,
  deleteProfesor,
}
