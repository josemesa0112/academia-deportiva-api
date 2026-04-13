const q = require('../queries/profesor.queries')

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

const createProfesor = async (req, res) => {
  try {
    const { rows } = await q.createProfesor(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateProfesor = async (req, res) => {
  try {
    const { rows } = await q.updateProfesor(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Profesor no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
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

module.exports = { getProfesores, getProfesorById, createProfesor, updateProfesor, deleteProfesor }