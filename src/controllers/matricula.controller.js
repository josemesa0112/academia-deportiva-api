const pool = require('../db')
const q = require('../queries/matricula.queries')

// Normaliza la lista opcional de deportistas del alcance. Devuelve null
// cuando aplica a todos, que es lo que esperan las consultas.
const normalizarIds = (valor) => {
  if (!Array.isArray(valor) || valor.length === 0) return null
  const ids = valor.map(v => Number(v)).filter(n => Number.isInteger(n) && n > 0)
  return ids.length > 0 ? ids : null
}

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

// POST /api/matriculas/marcar-anio
// { año, pagada, ids_deportistas? }
//
// Marca (o revierte) las matrículas de todo un año de una sola vez. Crea las
// que falten para que el registro quede completo, igual que en mensualidades.
const marcarAnioCompleto = async (req, res) => {
  const anio = Number(req.body?.año ?? req.body?.anio)
  const pagada = req.body?.pagada
  const ids = normalizarIds(req.body?.ids_deportistas)

  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    return res.status(400).json({ error: 'Año inválido' })
  }
  if (typeof pagada !== 'boolean') {
    return res.status(400).json({ error: 'El campo "pagada" debe ser true o false' })
  }

  if (!pagada) {
    try {
      const { rows } = await q.revertirAnioCompleto(anio, ids)
      return res.json({
        message: rows.length === 0
          ? `No había pagos registrados en las matrículas de ${anio}.`
          : `Se quitó el pago a ${rows.length} matrícula${rows.length === 1 ? '' : 's'} de ${anio}.`,
        revertidas: rows.length,
        año: anio,
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // Pagar existentes y crear faltantes son dos operaciones: van juntas en una
  // transacción para que no quede a medias.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: previas } = await q.contarPagadasDelAnio(anio, ids, client)
    const yaEstaban = previas[0].pagadas

    const { rows: actualizadas } = await q.pagarExistentesDelAnio(anio, ids, client)
    const { rows: creadas } = await q.crearYPagarFaltantesDelAnio(anio, ids, client)
    const { rows: sinValorRows } = await q.contarSinValorMatricula(anio, ids, client)

    await client.query('COMMIT')

    const nuevas = actualizadas.length + creadas.length
    const sinValor = sinValorRows[0].sin_valor

    const partes = []
    partes.push(nuevas === 0
      ? `Todas las matrículas de ${anio} ya estaban pagadas.`
      : `Se marcaron ${nuevas} matrícula${nuevas === 1 ? '' : 's'} como pagadas en ${anio}.`)
    if (creadas.length > 0) {
      partes.push(`${creadas.length} se crearon en el momento.`)
    }
    if (nuevas > 0 && yaEstaban > 0) partes.push(`${yaEstaban} ya lo estaban.`)
    if (sinValor > 0) {
      partes.push(`${sinValor} deportista${sinValor === 1 ? '' : 's'} quedó fuera: no se pudo deducir el valor de su matrícula.`)
    }

    res.json({
      message: partes.join(' '),
      marcadas: nuevas,
      creadas: creadas.length,
      ya_estaban: yaEstaban,
      sin_valor: sinValor,
      año: anio,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

module.exports = {
  marcarAnioCompleto,
  getMatriculas, getMatriculaById, getMatriculasByDeportista,
  createMatricula, updateMatricula, deleteMatricula,
  pagarMatricula, revertirPagoMatricula, generarAño
}