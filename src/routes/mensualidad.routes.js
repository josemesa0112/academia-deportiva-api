const router = require('express').Router()
const c = require('../controllers/mensualidad.controller')
const { mensualidadRules } = require('../middlewares/general.validators')
const validate = require('../middlewares/validate')

router.get('/', c.getMensualidades)
router.get('/deportista/:id_deportista', c.getMensualidadesByDeportista)
router.post('/generar-mes', c.generarMes)
router.post('/:id/pagar', c.pagarMensualidad)
router.post('/:id/revertir-pago', c.revertirPagoMensualidad)
router.get('/:id', c.getMensualidadById)
router.post('/', mensualidadRules, validate, c.createMensualidad)
router.put('/:id', mensualidadRules, validate, c.updateMensualidad)
router.delete('/:id', c.deleteMensualidad)

module.exports = router