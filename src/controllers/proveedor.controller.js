const q = require('../queries/proveedor.queries')

const getProveedores = async (req, res) => {
  try {
    const { rows } = await q.getProveedores()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getProveedorById = async (req, res) => {
  try {
    const { rows } = await q.getProveedorById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createProveedor = async (req, res) => {
  try {
    const { rows } = await q.createProveedor(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateProveedor = async (req, res) => {
  try {
    const { rows } = await q.updateProveedor(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deleteProveedor = async (req, res) => {
  try {
    const { rows } = await q.deleteProveedor(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json({ message: 'Proveedor desactivado correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getProveedores, getProveedorById, createProveedor, updateProveedor, deleteProveedor }