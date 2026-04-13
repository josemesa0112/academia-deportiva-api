const q = require('../queries/entrenamiento.queries')

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
  try {
    const { rows } = await q.createEntrenamiento(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateEntrenamiento = async (req, res) => {
  try {
    const { rows } = await q.updateEntrenamiento(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Entrenamiento no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
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