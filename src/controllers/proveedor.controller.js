const pool = require('../db')
const q = require('../queries/proveedor.queries')

// Convierte "1,2,3" o [1,2,3] en [1, 2, 3]
const parseProductos = (val) => {
  if (val === null || val === undefined || val === '') return []
  const arr = Array.isArray(val) ? val : String(val).split(',')
  return arr
    .map(v => Number(String(v).trim()))
    .filter(n => Number.isInteger(n) && n > 0)
}

// Sincroniza la tabla M:N: borra los que ya no están, inserta los nuevos.
const syncProductos = async (client, id_proveedor, productos) => {
  if (productos.length === 0) {
    await client.query('DELETE FROM tbd_proveedor_x_producto WHERE id_proveedor = $1', [id_proveedor])
    return
  }
  await client.query(
    `DELETE FROM tbd_proveedor_x_producto
     WHERE id_proveedor = $1 AND id_producto NOT IN (${productos.map((_, i) => `$${i + 2}`).join(',')})`,
    [id_proveedor, ...productos]
  )
  for (const id_producto of productos) {
    await client.query(
      `INSERT INTO tbd_proveedor_x_producto (id_proveedor, id_producto)
       VALUES ($1, $2)
       ON CONFLICT (id_proveedor, id_producto) DO NOTHING`,
      [id_proveedor, id_producto]
    )
  }
}

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

const getProductosDeProveedor = async (req, res) => {
  try {
    const { rows } = await q.getProductosByProveedor(req.params.id)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createProveedor = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await q.createProveedorRow(req.body, client)
    const proveedor = rows[0]

    const productos = parseProductos(req.body.productos)
    if (productos.length > 0) {
      await syncProductos(client, proveedor.id, productos)
    }

    await client.query('COMMIT')
    res.status(201).json(proveedor)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

const updateProveedor = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await q.updateProveedorRow(req.params.id, req.body, client)
    if (!rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Proveedor no encontrado' })
    }
    const proveedor = rows[0]

    // Si vinieron productos en el body, sincronizar. Si la propiedad
    // no viene, no se toca la relación (permite updates parciales).
    if (req.body.productos !== undefined) {
      await syncProductos(client, proveedor.id, parseProductos(req.body.productos))
    }

    await client.query('COMMIT')
    res.json(proveedor)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
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

module.exports = {
  getProveedores,
  getProveedorById,
  getProductosDeProveedor,
  createProveedor,
  updateProveedor,
  deleteProveedor,
}
