const q = require('../queries/dashboard.queries')
const qGastos = require('../queries/gasto.queries')

const getResumen = async (req, res) => {
  try {
    const ahora = new Date()
    const mesActual = ahora.getMonth() + 1
    const añoActual = ahora.getFullYear()

    // Mes anterior con manejo de cambio de año
    const fechaAnterior = new Date(añoActual, mesActual - 2, 1)
    const mesAnterior = fechaAnterior.getMonth() + 1
    const añoAnterior = fechaAnterior.getFullYear()

    // Ejecutamos todas las queries en paralelo — son independientes
    const [
      recaudoActual,
      recaudoAnterior,
      pendiente,
      matriculasPendientes,
      compras,
      gastosOperativos,
      gastosPorTipo,
      historica,
      porCategoria,
      conteos,
      asistencia,
      cumpleanos,
      proximos,
    ] = await Promise.all([
      q.getRecaudoMes(mesActual, añoActual),
      q.getRecaudoMes(mesAnterior, añoAnterior),
      q.getPendienteMes(mesActual, añoActual),
      q.getMatriculasPendientesTotal(),
      q.getComprasMes(mesActual, añoActual),
      qGastos.getTotalMes(mesActual, añoActual),
      qGastos.getPorTipoMes(mesActual, añoActual),
      q.getRecaudacionHistorica(),
      q.getDeportistasPorCategoria(),
      q.getConteos(),
      q.getAsistenciaPromedio(),
      q.getCumpleanosDelMes(mesActual),
      q.getProximosEntrenamientos(),
    ])

    const recaudoMes = Number(recaudoActual.rows[0].recaudo_mensualidades) +
                       Number(recaudoActual.rows[0].recaudo_matriculas)
    const recaudoMesAnterior = Number(recaudoAnterior.rows[0].recaudo_mensualidades) +
                               Number(recaudoAnterior.rows[0].recaudo_matriculas)

    const cambioPorcentual = recaudoMesAnterior > 0
      ? ((recaudoMes - recaudoMesAnterior) / recaudoMesAnterior) * 100
      : null

    // "Gastos del mes" = compras a proveedores + egresos operativos
    // (arriendo, servicios, nómina...). Se devuelve el total y el desglose.
    const totalCompras = Number(compras.rows[0].total)
    const totalGastosOperativos = Number(gastosOperativos.rows[0].total)
    const gastosTotales = totalCompras + totalGastosOperativos

    const asistenciaRow = asistencia.rows[0]
    const porcentajeAsistencia = asistenciaRow.total > 0
      ? Math.round((asistenciaRow.presentes / asistenciaRow.total) * 100)
      : null

    res.json({
      periodo: { mes: mesActual, año: añoActual },
      financiero: {
        recaudo_mes: recaudoMes,
        recaudo_mensualidades: Number(recaudoActual.rows[0].recaudo_mensualidades),
        recaudo_matriculas: Number(recaudoActual.rows[0].recaudo_matriculas),
        pendiente: Number(pendiente.rows[0].pendiente),
        cantidad_pendientes: pendiente.rows[0].cantidad_pendientes,
        pendiente_matriculas: Number(matriculasPendientes.rows[0].pendiente),
        cantidad_pendientes_matriculas: matriculasPendientes.rows[0].cantidad_pendientes,
        gastos: gastosTotales,
        gastos_compras: totalCompras,
        cantidad_compras: compras.rows[0].cantidad_compras,
        gastos_operativos: totalGastosOperativos,
        cantidad_gastos: gastosOperativos.rows[0].cantidad,
        gastos_por_tipo: gastosPorTipo.rows.map(r => ({
          tipo: r.tipo,
          total: Number(r.total),
        })),
        balance_mes: recaudoMes - gastosTotales,
        recaudo_mes_anterior: recaudoMesAnterior,
        cambio_porcentual: cambioPorcentual,
      },
      conteos: {
        deportistas: conteos.rows[0].deportistas,
        profesores: conteos.rows[0].profesores,
        proveedores: conteos.rows[0].proveedores,
        porcentaje_asistencia: porcentajeAsistencia,
      },
      recaudacion_historica: historica.rows.map(r => ({
        periodo: r.periodo,
        mes: r.mes,
        año: r.año,
        total: Number(r.recaudo_mensualidades) + Number(r.recaudo_matriculas),
      })),
      deportistas_por_categoria: porCategoria.rows,
      cumpleanos_del_mes: cumpleanos.rows,
      proximos_entrenamientos: proximos.rows,
    })
  } catch (err) {
    console.error('[dashboard/resumen] error:', err)
    res.status(500).json({ error: err.message, stack: err.stack })
  }
}

module.exports = { getResumen }
