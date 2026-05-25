const q = require('../queries/mensualidad.queries')

const getMensualidades = async (req, res) => {
  try {
    // Lazy creation: asegura que las mensualidades del mes actual existan
    // para todos los deportistas activos. Es idempotente (no duplica).
    const ahora = new Date()
    const mesActual = ahora.getMonth() + 1
    const añoActual = ahora.getFullYear()
    await q.generarMensualidadesDelMes(mesActual, añoActual)

    const { rows } = await q.getMensualidades()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getMensualidadById = async (req, res) => {
  try {
    const { rows } = await q.getMensualidadById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Mensualidad no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getMensualidadesByDeportista = async (req, res) => {
  try {
    const { rows } = await q.getMensualidadesByDeportista(req.params.id_deportista)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createMensualidad = async (req, res) => {
  try {
    const { rows } = await q.createMensualidad(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateMensualidad = async (req, res) => {
  try {
    const { rows } = await q.updateMensualidad(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Mensualidad no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deleteMensualidad = async (req, res) => {
  try {
    const { rows } = await q.deleteMensualidad(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Mensualidad no encontrada' })
    res.json({ message: 'Mensualidad desactivada correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const pagarMensualidad = async (req, res) => {
  try {
    const { rows } = await q.marcarPagada(req.params.id)
    if (!rows.length) {
      return res.status(409).json({ error: 'La mensualidad no existe o ya fue pagada' })
    }
    res.json({ message: 'Pago registrado correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const generarMes = async (req, res) => {
  try {
    const ahora = new Date()
    const mes = req.body?.mes ? Number(req.body.mes) : ahora.getMonth() + 1
    const año = req.body?.año ? Number(req.body.año) : ahora.getFullYear()
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return res.status(400).json({ error: 'Mes inválido (1-12)' })
    }
    if (!Number.isInteger(año) || año < 2000) {
      return res.status(400).json({ error: 'Año inválido' })
    }
    const { rows } = await q.generarMensualidadesDelMes(mes, año)
    res.json({
      message: rows.length === 0
        ? 'No se crearon mensualidades nuevas (ya estaban generadas)'
        : `Se generaron ${rows.length} mensualidad${rows.length === 1 ? '' : 'es'} nueva${rows.length === 1 ? '' : 's'}`,
      creadas: rows.length,
      mes,
      año,
      data: rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getMensualidades,
  getMensualidadById,
  getMensualidadesByDeportista,
  createMensualidad,
  updateMensualidad,
  deleteMensualidad,
  pagarMensualidad,
  generarMes,
}
