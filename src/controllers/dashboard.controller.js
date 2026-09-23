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
      conteosRows,
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

    const porcentaje = (row) => (row && row.total > 0
      ? Math.round((row.presentes / row.total) * 100)
      : null)

    // El profesor ve su propio alcance, no las cifras del club: los
    // deportistas de sus categorías y la asistencia de SUS sesiones.
    // Se omiten los conteos de profesores y proveedores, que no le
    // competen.
    const esProfesor = req.persona?.id_rol === 2
    const esDeportista = req.persona?.id_rol === 3
    let conteos
    // Solo se llena para el deportista: su categoría y quién la dirige.
    let contextoDeportista = null
    // Por defecto, los del club; el profesor ve solo los de sus categorías.
    let proximosEntrenamientos = proximos.rows

    if (esDeportista) {
      const { rows: fichas } = await q.getDeportistaPorPersona(req.persona.id)
      const ficha = fichas[0]

      // El deportista no recibe ninguna cifra del club.
      conteos = { alcance: 'deportista' }

      if (!ficha || !ficha.id_categoria) {
        proximosEntrenamientos = []
        contextoDeportista = { categoria: ficha?.categoria || null, profesores: [] }
      } else {
        const [misEntrenamientos, susProfesores] = await Promise.all([
          q.getProximosEntrenamientosCategoria(ficha.id_categoria),
          q.getProfesoresDeCategoria(ficha.id_categoria),
        ])
        proximosEntrenamientos = misEntrenamientos.rows
        contextoDeportista = {
          categoria: ficha.categoria,
          profesores: susProfesores.rows,
        }
      }
    } else if (esProfesor) {
      const { rows: fichas } = await q.getProfesorPorPersona(req.persona.id)
      const idProfesor = fichas[0]?.id

      if (!idProfesor) {
        // Persona con rol Profesor pero sin ficha creada todavía.
        conteos = { alcance: 'profesor', deportistas: 0, porcentaje_asistencia: null }
        proximosEntrenamientos = []
      } else {
        const [misDeportistas, miAsistencia, misProximos] = await Promise.all([
          q.getConteosProfesor(idProfesor),
          q.getAsistenciaProfesor(idProfesor),
          q.getProximosEntrenamientosProfesor(idProfesor),
        ])
        conteos = {
          alcance: 'profesor',
          deportistas: misDeportistas.rows[0].deportistas,
          porcentaje_asistencia: porcentaje(miAsistencia.rows[0]),
        }
        proximosEntrenamientos = misProximos.rows
      }
    } else {
      conteos = {
        alcance: 'club',
        deportistas: conteosRows.rows[0].deportistas,
        profesores: conteosRows.rows[0].profesores,
        proveedores: conteosRows.rows[0].proveedores,
        porcentaje_asistencia: porcentaje(asistencia.rows[0]),
      }
    }

    res.json({
      periodo: { mes: mesActual, año: añoActual },
      financiero: {
        recaudo_mes: recaudoMes,
        recaudo_mensualidades: Number(recaudoActual.rows[0].recaudo_mensualidades),
        recaudo_matriculas: Number(recaudoActual.rows[0].recaudo_matriculas),
        pendiente: Number(pendiente.rows[0].pendiente),
        cantidad_pendientes: pendiente.rows[0].cantidad_pendientes,
        // Deuda de deportistas inactivos: se informa aparte, fuera de la
        // cartera, para que no se pierda de vista sin inflar la cifra.
        pendiente_inactivos: Number(pendiente.rows[0].pendiente_inactivos),
        cantidad_pendientes_inactivos: pendiente.rows[0].cantidad_inactivos,
        pendiente_matriculas: Number(matriculasPendientes.rows[0].pendiente),
        cantidad_pendientes_matriculas: matriculasPendientes.rows[0].cantidad_pendientes,
        pendiente_matriculas_inactivos: Number(matriculasPendientes.rows[0].pendiente_inactivos),
        cantidad_pendientes_matriculas_inactivos: matriculasPendientes.rows[0].cantidad_inactivos,
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
      conteos,
      contexto_deportista: contextoDeportista,
      recaudacion_historica: historica.rows.map(r => ({
        periodo: r.periodo,
        mes: r.mes,
        año: r.año,
        total: Number(r.recaudo_mensualidades) + Number(r.recaudo_matriculas),
      })),
      deportistas_por_categoria: porCategoria.rows,
      cumpleanos_del_mes: cumpleanos.rows,
      proximos_entrenamientos: proximosEntrenamientos,
    })
  } catch (err) {
    console.error('[dashboard/resumen] error:', err)
    res.status(500).json({ error: err.message, stack: err.stack })
  }
}

module.exports = { getResumen }
