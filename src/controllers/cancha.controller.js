const q = require('../queries/cancha.queries')

const getCanchas = async (req, res) => {
  try {
    const { rows } = await q.getCanchas()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getCanchaById = async (req, res) => {
  try {
    const { rows } = await q.getCanchaById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Cancha no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createCancha = async (req, res) => {
  try {
    const { rows } = await q.createCancha(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateCancha = async (req, res) => {
  try {
    const { rows } = await q.updateCancha(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Cancha no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deleteCancha = async (req, res) => {
  try {
    const { rows } = await q.deleteCancha(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Cancha no encontrada' })
    res.json({ message: 'Cancha desactivada correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getCanchas, getCanchaById, createCancha, updateCancha, deleteCancha }