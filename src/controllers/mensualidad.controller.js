const q = require('../queries/mensualidad.queries')

const getMensualidades = async (req, res) => {
  try {
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

module.exports = {
  getMensualidades, getMensualidadById, getMensualidadesByDeportista,
  createMensualidad, updateMensualidad, deleteMensualidad
}