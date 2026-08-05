const router = require('express').Router()
const c = require('../controllers/mensualidad.controller')
const { mensualidadRules } = require('../middlewares/general.validators')
const validate = require('../middlewares/validate')
const { requireRol } = require('../middlewares/requireAuth')

// La cartera del club es información del Administrador. Un deportista solo
// ve la suya, a través de /deportista/:id_deportista desde su perfil.
const soloAdmin = requireRol(1)

router.get('/', c.getMensualidades)
// Vista de grilla anual. Va antes de '/:id' para que 'anio' no se lea como id.
router.get('/anio/:año', soloAdmin, c.getMatrizAnual)
router.post('/marcar', soloAdmin, c.marcarPeriodo)
router.get('/deportista/:id_deportista', c.getMensualidadesByDeportista)
router.post('/generar-mes', c.generarMes)
router.post('/:id/pagar', c.pagarMensualidad)
router.post('/:id/revertir-pago', c.revertirPagoMensualidad)
router.get('/:id', c.getMensualidadById)
router.post('/', mensualidadRules, validate, c.createMensualidad)
router.put('/:id', mensualidadRules, validate, c.updateMensualidad)
router.delete('/:id', c.deleteMensualidad)

module.exports = router