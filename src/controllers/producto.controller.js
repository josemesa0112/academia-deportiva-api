const q = require('../queries/producto.queries')

const getProductos = async (req, res) => {
  try {
    const { rows } = await q.getProductos()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getProductoById = async (req, res) => {
  try {
    const { rows } = await q.getProductoById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createProducto = async (req, res) => {
  try {
    const { rows } = await q.createProducto(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateProducto = async (req, res) => {
  try {
    const { rows } = await q.updateProducto(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deleteProducto = async (req, res) => {
  try {
    const { rows } = await q.deleteProducto(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json({ message: 'Producto eliminado correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getProductos, getProductoById, createProducto, updateProducto, deleteProducto }