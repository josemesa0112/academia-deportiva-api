const q = require('../queries/matricula.queries')

const getMatriculas = async (req, res) => {
  try {
    const { rows } = await q.getMatriculas()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getMatriculaById = async (req, res) => {
  try {
    const { rows } = await q.getMatriculaById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Matrícula no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getMatriculasByDeportista = async (req, res) => {
  try {
    const { rows } = await q.getMatriculasByDeportista(req.params.id_deportista)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createMatricula = async (req, res) => {
  try {
    const { rows } = await q.createMatricula(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateMatricula = async (req, res) => {
  try {
    const { rows } = await q.updateMatricula(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Matrícula no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deleteMatricula = async (req, res) => {
  try {
    const { rows } = await q.deleteMatricula(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Matrícula no encontrada' })
    res.json({ message: 'Matrícula desactivada correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getMatriculas, getMatriculaById, getMatriculasByDeportista,
  createMatricula, updateMatricula, deleteMatricula
}