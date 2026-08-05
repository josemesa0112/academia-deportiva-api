const pool = require('../db')
const q = require('../queries/mensualidad.queries')

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Normaliza la lista opcional de deportistas del alcance. Devuelve null
// cuando aplica a todos, que es lo que esperan las consultas.
const normalizarIds = (valor) => {
  if (!Array.isArray(valor) || valor.length === 0) return null
  const ids = valor
    .map(v => Number(v))
    .filter(n => Number.isInteger(n) && n > 0)
  return ids.length > 0 ? ids : null
}

const getMensualidades = async (req, res) => {
  try {
    // Lazy creation: asegura que las mensualidades del mes actual existan
    // para todos los deportistas activos. Es idempotente (no duplica).
    const ahora = new Date()
    const mesActual = ahora.getMonth() + 1
    const añoActual = ahora.getFullYear()
    await q.generarMensualidadesDelMes(mesActual, añoActual)

    // Solo devolvemos las del mes actual. El historial completo de cada
    // deportista vive en /api/mensualidades/deportista/:id (perfil).
    const { rows } = await q.getMensualidades(mesActual, añoActual)
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

const revertirPagoMensualidad = async (req, res) => {
  try {
    const { rows } = await q.revertirPago(req.params.id)
    if (!rows.length) {
      return res.status(409).json({ error: 'La mensualidad no existe o no estaba pagada' })
    }
    res.json({ message: 'Pago revertido correctamente', data: rows[0] })
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

// GET /api/mensualidades/anio/:año
// Matriz para la vista de grilla: deportistas x 12 meses.
const getMatrizAnual = async (req, res) => {
  try {
    const año = Number(req.params.año)
    if (!Number.isInteger(año) || año < 2000 || año > 2100) {
      return res.status(400).json({ error: 'Año inválido' })
    }

    const { rows } = await q.getMatrizAnual(año)

    // Se normaliza a un arreglo de 12 posiciones para que el cliente no
    // tenga que buscar el mes dentro de una lista.
    const deportistas = rows.map(r => {
      const meses = Array.from({ length: 12 }, () => null)
      for (const m of r.meses) {
        if (m.mes >= 1 && m.mes <= 12) {
          meses[m.mes - 1] = {
            id: m.id,
            valor: m.valor === null ? null : Number(m.valor),
            pagada: m.fecha_pago !== null,
            fecha_pago: m.fecha_pago,
          }
        }
      }
      return {
        id_deportista: r.id_deportista,
        nombre: r.nombre,
        apellido: r.apellido,
        numero_documento: r.numero_documento,
        id_categoria: r.id_categoria,
        categoria: r.categoria,
        valor_mensualidad: r.valor_mensualidad === null ? null : Number(r.valor_mensualidad),
        meses,
      }
    })

    // Totales por mes, para el pie de la grilla.
    const totales_por_mes = Array.from({ length: 12 }, (_, i) => {
      let pagadas = 0, pendientes = 0, recaudado = 0
      for (const d of deportistas) {
        const celda = d.meses[i]
        if (!celda) continue
        if (celda.pagada) { pagadas++; recaudado += celda.valor || 0 }
        else pendientes++
      }
      return { mes: i + 1, pagadas, pendientes, recaudado }
    })

    res.json({ año, deportistas, totales_por_mes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// POST /api/mensualidades/marcar  { id_deportista, mes, año, pagada }
// Permite marcar o desmarcar cualquier mes del año, exista o no la fila.
// Crear al vuelo es lo que habilita registrar pagos por adelantado.
const marcarPeriodo = async (req, res) => {
  try {
    const id_deportista = Number(req.body?.id_deportista)
    const mes = Number(req.body?.mes)
    const año = Number(req.body?.año)
    const pagada = req.body?.pagada

    if (!Number.isInteger(id_deportista) || id_deportista < 1) {
      return res.status(400).json({ error: 'Deportista inválido' })
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return res.status(400).json({ error: 'Mes inválido (1-12)' })
    }
    if (!Number.isInteger(año) || año < 2000 || año > 2100) {
      return res.status(400).json({ error: 'Año inválido' })
    }
    if (typeof pagada !== 'boolean') {
      return res.status(400).json({ error: 'El campo "pagada" debe ser true o false' })
    }

    const { rows: deps } = await q.getDeportistaParaMensualidad(id_deportista)
    const deportista = deps[0]
    if (!deportista) return res.status(404).json({ error: 'Deportista no encontrado' })
    if (deportista.id_estado !== 1) {
      return res.status(409).json({ error: 'El deportista está inactivo' })
    }

    if (!pagada) {
      const { rows } = await q.revertirPagoDePeriodo(id_deportista, mes, año)
      if (!rows.length) {
        return res.status(404).json({ error: 'No hay mensualidad registrada para ese periodo' })
      }
      return res.json({ message: 'Pago revertido correctamente', data: rows[0] })
    }

    // Al crear la fila hace falta un valor. Si ya existe, se respeta el suyo
    // (puede diferir del actual si la tarifa cambió después).
    const { rows: existentes } = await q.getMensualidadDePeriodo(id_deportista, mes, año)
    const existente = existentes[0]
    const valor = existente ? existente.valor : deportista.valor_mensualidad

    if (!existente && (valor === null || Number(valor) <= 0)) {
      return res.status(409).json({
        error: `${deportista.nombre} ${deportista.apellido} no tiene valor de mensualidad definido. Asígnaselo en Deportistas antes de registrar el pago.`,
      })
    }

    const { rows } = await q.marcarPagoDePeriodo(id_deportista, mes, año, valor)
    res.json({ message: 'Pago registrado correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// POST /api/mensualidades/marcar-mes
// { mes, año, pagada, ids_deportistas? }
//
// Marca (o revierte) un mes completo de una sola vez. `ids_deportistas`
// permite acotarlo a lo que el administrador tiene filtrado en pantalla,
// para que la acción coincida con lo que está viendo.
const marcarMesCompleto = async (req, res) => {
  const mes = Number(req.body?.mes)
  const año = Number(req.body?.año)
  const pagada = req.body?.pagada
  const ids = normalizarIds(req.body?.ids_deportistas)

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return res.status(400).json({ error: 'Mes inválido (1-12)' })
  }
  if (!Number.isInteger(año) || año < 2000 || año > 2100) {
    return res.status(400).json({ error: 'Año inválido' })
  }
  if (typeof pagada !== 'boolean') {
    return res.status(400).json({ error: 'El campo "pagada" debe ser true o false' })
  }

  const etiqueta = `${MESES[mes - 1]} de ${año}`

  if (!pagada) {
    try {
      const { rows } = await q.revertirMesCompleto(mes, año, ids)
      return res.json({
        message: rows.length === 0
          ? `No había pagos registrados en ${etiqueta}.`
          : `Se quitó el pago a ${rows.length} mensualidad${rows.length === 1 ? '' : 'es'} de ${etiqueta}.`,
        revertidas: rows.length,
        mes, año,
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // Marcar es dos operaciones (actualizar existentes + crear faltantes):
  // van en una transacción para que no quede a medias.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: previas } = await q.contarPagadasDelMes(mes, año, ids, client)
    const yaEstaban = previas[0].pagadas

    const { rows: actualizadas } = await q.pagarExistentesDelMes(mes, año, ids, client)
    const { rows: creadas } = await q.crearYPagarFaltantesDelMes(mes, año, ids, client)
    const { rows: sinValorRows } = await q.contarSinValorMensualidad(ids, client)

    await client.query('COMMIT')

    const nuevas = actualizadas.length + creadas.length
    const sinValor = sinValorRows[0].sin_valor

    const partes = []
    partes.push(nuevas === 0
      ? `Todos ya estaban pagados en ${etiqueta}.`
      : `Se marcaron ${nuevas} mensualidad${nuevas === 1 ? '' : 'es'} como pagadas en ${etiqueta}.`)
    if (nuevas > 0 && yaEstaban > 0) partes.push(`${yaEstaban} ya lo estaban.`)
    if (sinValor > 0) {
      partes.push(`${sinValor} deportista${sinValor === 1 ? '' : 's'} quedó fuera por no tener valor de mensualidad definido.`)
    }

    res.json({
      message: partes.join(' '),
      marcadas: nuevas,
      creadas: creadas.length,
      ya_estaban: yaEstaban,
      sin_valor: sinValor,
      mes, año,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

module.exports = {
  getMatrizAnual,
  marcarPeriodo,
  marcarMesCompleto,
  getMensualidades,
  getMensualidadById,
  getMensualidadesByDeportista,
  createMensualidad,
  updateMensualidad,
  deleteMensualidad,
  pagarMensualidad,
  revertirPagoMensualidad,
  generarMes,
}
