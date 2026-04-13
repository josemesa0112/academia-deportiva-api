const q = require('../queries/catalogos.queries')

const getEstados = async (req, res) => {
  try {
    const { rows } = await q.getEstados()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getRoles = async (req, res) => {
  try {
    const { rows } = await q.getRoles()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getGeneros = async (req, res) => {
  try {
    const { rows } = await q.getGeneros()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getTiposDocumento = async (req, res) => {
  try {
    const { rows } = await q.getTiposDocumento()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getClasificaciones = async (req, res) => {
  try {
    const { rows } = await q.getClasificaciones()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getCategorias = async (req, res) => {
  try {
    const { rows } = await q.getCategorias()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getPosiciones = async (req, res) => {
  try {
    const { rows } = await q.getPosiciones()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getTiposProducto = async (req, res) => {
  try {
    const { rows } = await q.getTiposProducto()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getVariantesProducto = async (req, res) => {
  try {
    const { rows } = await q.getVariantesProducto()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getEstados,
  getRoles,
  getGeneros,
  getTiposDocumento,
  getClasificaciones,
  getCategorias,
  getPosiciones,
  getTiposProducto,
  getVariantesProducto
}