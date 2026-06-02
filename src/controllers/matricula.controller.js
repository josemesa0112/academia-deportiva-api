const q = require('../queries/matricula.queries')

const getMatriculas = async (req, res) => {
  try {
    const { rows } = await q.getMatriculas()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getMatriculaById = async (req, res) => {
  try {
    const { rows } = await q.getMatriculaById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Matrícula no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getMatriculasByDeportista = async (req, res) => {
  try {
    const { rows } = await q.getMatriculasByDeportista(req.params.id_deportista)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createMatricula = async (req, res) => {
  try {
    const { rows } = await q.createMatricula(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateMatricula = async (req, res) => {
  try {
    const { rows } = await q.updateMatricula(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Matrícula no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deleteMatricula = async (req, res) => {
  try {
    const { rows } = await q.deleteMatricula(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Matrícula no encontrada' })
    res.json({ message: 'Matrícula desactivada correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const pagarMatricula = async (req, res) => {
  try {
    const { rows } = await q.marcarPagada(req.params.id)
    if (!rows.length) {
      return res.status(409).json({ error: 'La matrícula no existe o ya fue pagada' })
    }
    res.json({ message: 'Pago registrado correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const revertirPagoMatricula = async (req, res) => {
  try {
    const { rows } = await q.revertirPago(req.params.id)
    if (!rows.length) {
      return res.status(409).json({ error: 'La matrícula no existe o no estaba pagada' })
    }
    res.json({ message: 'Pago revertido correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const generarAño = async (req, res) => {
  try {
    const ahora = new Date()
    const año = req.body?.año ? Number(req.body.año) : ahora.getFullYear()
    if (!Number.isInteger(año) || año < 2000) {
      return res.status(400).json({ error: 'Año inválido' })
    }
    const { rows } = await q.generarMatriculasDelAño(año)
    res.json({
      message: rows.length === 0
        ? `No se crearon matrículas nuevas. Todos los deportistas activos ya tienen matrícula para ${año}.`
        : `Se generaron ${rows.length} matrícula${rows.length === 1 ? '' : 's'} para ${año}.`,
      creadas: rows.length,
      año,
      data: rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getMatriculas, getMatriculaById, getMatriculasByDeportista,
  createMatricula, updateMatricula, deleteMatricula,
  pagarMatricula, revertirPagoMatricula, generarAño
}