const q = require('../queries/asistencia.queries')

const getAsistencias = async (req, res) => {
  try {
    const { rows } = await q.getAsistencias()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getAsistenciaById = async (req, res) => {
  try {
    const { rows } = await q.getAsistenciaById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Asistencia no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getAsistenciasByEntrenamiento = async (req, res) => {
  try {
    const { rows } = await q.getAsistenciasByEntrenamiento(req.params.id_entrenamiento)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getAsistenciasByDeportista = async (req, res) => {
  try {
    const { rows } = await q.getAsistenciasByDeportista(req.params.id_deportista)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createAsistencia = async (req, res) => {
  try {
    const { rows } = await q.createAsistencia(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateAsistencia = async (req, res) => {
  try {
    const { rows } = await q.updateAsistencia(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Asistencia no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deleteAsistencia = async (req, res) => {
  try {
    const { rows } = await q.deleteAsistencia(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Asistencia no encontrada' })
    res.json({ message: 'Asistencia desactivada correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getAsistencias, getAsistenciaById, getAsistenciasByEntrenamiento,
  getAsistenciasByDeportista, createAsistencia, updateAsistencia, deleteAsistencia
}