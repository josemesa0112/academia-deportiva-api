const router = require('express').Router()
const c = require('../controllers/matricula.controller')
const { matriculaRules } = require('../middlewares/general.validators')
const validate = require('../middlewares/validate')

router.get('/', c.getMatriculas)
router.get('/deportista/:id_deportista', c.getMatriculasByDeportista)
router.post('/generar-anio', c.generarAño)
router.post('/:id/pagar', c.pagarMatricula)
router.post('/:id/revertir-pago', c.revertirPagoMatricula)
router.get('/:id', c.getMatriculaById)
router.post('/', matriculaRules, validate, c.createMatricula)
router.put('/:id', matriculaRules, validate, c.updateMatricula)
router.delete('/:id', c.deleteMatricula)

module.exports = router