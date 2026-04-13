const q = require('../queries/deportista.queries')

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
  try {
    const { rows } = await q.createDeportista(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateDeportista = async (req, res) => {
  try {
    const { rows } = await q.updateDeportista(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Deportista no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
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

module.exports = { getDeportistas, getDeportistaById, createDeportista, updateDeportista, deleteDeportista }