const pool = require('../db')
const q = require('../queries/compra.queries')
const qpxc = require('../queries/productoXcompra.queries')

// Valida un item del detalle de compra. Devuelve true si tiene los
// 3 campos mínimos (id_producto, cantidad, precio) en formato válido.
const itemValido = (it) => {
  if (!it) return false
  const idp = Number(it.id_producto)
  const cant = Number(it.cantidad_productos)
  const pr = Number(it.precio)
  return Number.isInteger(idp) && idp > 0
    && Number.isFinite(cant) && cant > 0
    && Number.isFinite(pr) && pr >= 0
}

// Inserta todos los items recibidos en tbd_producto_x_compra.
const insertarItems = async (client, id_compra, items) => {
  if (!Array.isArray(items)) return
  for (const it of items) {
    if (!itemValido(it)) continue
    await qpxc.addProductoToCompra({
      id_producto: it.id_producto,
      id_compra,
      cantidad_productos: it.cantidad_productos,
      precio: it.precio,
    }, client)
  }
}

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
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { items, ...compraData } = req.body
    const { rows } = await q.createCompraRow(compraData, client)
    const compra = rows[0]

    await insertarItems(client, compra.id, items)

    await client.query('COMMIT')
    res.status(201).json(compra)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

const updateCompra = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { items, ...compraData } = req.body
    const { rows } = await q.updateCompraRow(req.params.id, compraData, client)
    if (!rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Compra no encontrada' })
    }
    const compra = rows[0]

    // Si el cliente envía items, sincronizamos: borrar todos los anteriores
    // y reinsertar el set nuevo. Si no envía items, no se tocan.
    if (items !== undefined) {
      await qpxc.deleteAllByCompra(compra.id, client)
      await insertarItems(client, compra.id, items)
    }

    await client.query('COMMIT')
    res.json(compra)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
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

// Endpoints granulares — se mantienen por compatibilidad pero el flujo
// estándar ahora usa createCompra/updateCompra con items en el body.
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

module.exports = {
  getCompras,
  getCompraById,
  createCompra,
  updateCompra,
  deleteCompra,
  addProductoToCompra,
  removeProductoFromCompra,
}
