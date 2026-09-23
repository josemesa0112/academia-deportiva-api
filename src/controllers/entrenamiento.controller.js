const pool = require('../db')
const q = require('../queries/entrenamiento.queries')

// Acepta "1,2,3" o [1,2,3] y devuelve [1, 2, 3].
const parseProfesores = (val) => {
  if (val === null || val === undefined || val === '') return []
  const arr = Array.isArray(val) ? val : String(val).split(',')
  return arr
    .map(v => Number(String(v).trim()))
    .filter(n => Number.isInteger(n) && n > 0)
}

const getEntrenamientos = async (req, res) => {
  try {
    const { rows } = await q.getEntrenamientos()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getEntrenamientoById = async (req, res) => {
  try {
    const { rows } = await q.getEntrenamientoById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Entrenamiento no encontrado' })
    const profesores = await q.getProfesoresByEntrenamiento(req.params.id)
    res.json({ ...rows[0], profesores: profesores.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createEntrenamiento = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await q.createEntrenamiento(req.body, client)
    const entrenamiento = rows[0]

    // Los profesores asignados son los que hacen que la sesion cuente
    // para su pago, asi que se guardan en la misma transaccion.
    const profesores = parseProfesores(req.body.profesores)
    if (profesores.length > 0) {
      await q.syncProfesores(client, entrenamiento.id, profesores)
    }

    await client.query('COMMIT')
    res.status(201).json(entrenamiento)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

const updateEntrenamiento = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await q.updateEntrenamiento(req.params.id, req.body, client)
    if (!rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Entrenamiento no encontrado' })
    }

    // Si no viene la propiedad, la relacion no se toca (update parcial).
    if (req.body.profesores !== undefined) {
      await q.syncProfesores(client, rows[0].id, parseProfesores(req.body.profesores))
    }

    await client.query('COMMIT')
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

const deleteEntrenamiento = async (req, res) => {
  try {
    const { rows } = await q.deleteEntrenamiento(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Entrenamiento no encontrado' })
    res.json({ message: 'Entrenamiento desactivado correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const addProfesorToEntrenamiento = async (req, res) => {
  try {
    const { rows } = await q.addProfesorToEntrenamiento(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const removeProfesorFromEntrenamiento = async (req, res) => {
  try {
    const { rows } = await q.removeProfesorFromEntrenamiento(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Registro no encontrado' })
    res.json({ message: 'Profesor removido del entrenamiento', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getEntrenamientos, getEntrenamientoById, createEntrenamiento,
  updateEntrenamiento, deleteEntrenamiento,
  addProfesorToEntrenamiento, removeProfesorFromEntrenamiento
}