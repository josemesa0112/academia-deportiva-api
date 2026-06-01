const pool = require('../db')
const q = require('../queries/producto.queries')

// Inserta una fila en el historial de precios. Se llama cada vez que el
// precio se establece o cambia. Idempotente al nivel de negocio: no
// inserta si el precio recibido es null/0/inválido.
const insertPrecioHistorico = (client, id_producto, precio) => {
  const p = Number(precio)
  if (!Number.isFinite(p) || p <= 0) return Promise.resolve()
  return client.query(
    `INSERT INTO tbd_precio_producto_historico (id_producto, precio, fecha)
     VALUES ($1, $2, NOW())`,
    [id_producto, p]
  )
}

const precioCambia = (anterior, nuevo) => {
  if (anterior === null || anterior === undefined) return true
  return Number(anterior) !== Number(nuevo)
}

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
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await q.createProductoRow(req.body, client)
    const producto = rows[0]

    // Registra el precio inicial en el historial
    await insertPrecioHistorico(client, producto.id, producto.precio_producto)

    await client.query('COMMIT')
    res.status(201).json(producto)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

const updateProducto = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Snapshot anterior para detectar cambio de precio
    const { rows: snapshotRows } = await q.getProductoPrecioActual(req.params.id, client)
    if (!snapshotRows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Producto no encontrado' })
    }
    const precioAnterior = snapshotRows[0].precio_producto

    const { rows } = await q.updateProductoRow(req.params.id, req.body, client)
    const producto = rows[0]

    // Si el precio cambió, registra la nueva entrada en el historial
    if (precioCambia(precioAnterior, producto.precio_producto)) {
      await insertPrecioHistorico(client, producto.id, producto.precio_producto)
    }

    await client.query('COMMIT')
    res.json(producto)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
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

const getPreciosHistoricos = async (req, res) => {
  try {
    const { rows } = await q.getHistorialPrecios(req.params.id)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto,
  getPreciosHistoricos,
}
