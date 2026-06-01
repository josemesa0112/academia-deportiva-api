const q = require('../queries/profesor.queries')

// Traduce errores de PostgreSQL a respuestas HTTP claras
const handleDbError = (err, res) => {
  if (err.code === '23505' && err.constraint === 'uniq_profesor_id_persona') {
    return res.status(409).json({ error: 'Esta persona ya está registrada como profesor' })
  }
  return res.status(500).json({ error: err.message })
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

const createProfesor = async (req, res) => {
  try {
    const { rows } = await q.createProfesor(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    handleDbError(err, res)
  }
}

const updateProfesor = async (req, res) => {
  try {
    const { rows } = await q.updateProfesor(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Profesor no encontrado' })
    res.json(rows[0])
  } catch (err) {
    handleDbError(err, res)
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