const q = require('../queries/compra.queries')
const qpxc = require('../queries/productoXcompra.queries')

const getCompras = async (req, res) => {
  try {
    const { rows } = await q.getCompras()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getCompraById = async (req, res) => {
  try {
    const { rows } = await q.getCompraById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Compra no encontrada' })
    const productos = await qpxc.getProductosByCompra(req.params.id)
    res.json({ ...rows[0], productos: productos.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createCompra = async (req, res) => {
  try {
    const { rows } = await q.createCompra(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateCompra = async (req, res) => {
  try {
    const { rows } = await q.updateCompra(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Compra no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deleteCompra = async (req, res) => {
  try {
    const { rows } = await q.deleteCompra(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Compra no encontrada' })
    res.json({ message: 'Compra desactivada correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const addProductoToCompra = async (req, res) => {
  try {
    const { rows } = await qpxc.addProductoToCompra(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const removeProductoFromCompra = async (req, res) => {
  try {
    const { rows } = await qpxc.removeProductoFromCompra(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Registro no encontrado' })
    res.json({ message: 'Producto removido de la compra', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getCompras, getCompraById, createCompra, updateCompra, deleteCompra, addProductoToCompra, removeProductoFromCompra }