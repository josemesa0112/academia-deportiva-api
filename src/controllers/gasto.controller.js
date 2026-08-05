const q = require('../queries/gasto.queries')

const getGastos = async (req, res) => {
  try {
    const { rows } = await q.getGastos()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getGastoById = async (req, res) => {
  try {
    const { rows } = await q.getGastoById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Gasto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createGasto = async (req, res) => {
  try {
    const { rows } = await q.createGasto(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateGasto = async (req, res) => {
  try {
    const { rows } = await q.updateGasto(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Gasto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// No se borra físicamente: se anula, para no alterar cierres de meses previos.
const deleteGasto = async (req, res) => {
  try {
    const { rows } = await q.anularGasto(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Gasto no encontrado' })
    res.json({ message: 'Gasto anulado correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getGastos, getGastoById, createGasto, updateGasto, deleteGasto }