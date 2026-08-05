const router = require('express').Router()
const c = require('../controllers/gasto.controller')
const { gastoRules } = require('../middlewares/gasto.validators')
const validate = require('../middlewares/validate')
const { requireRol } = require('../middlewares/requireAuth')

// Solo el Administrador maneja los egresos del club.
const soloAdmin = requireRol(1)

router.get('/', soloAdmin, c.getGastos)
router.get('/:id', soloAdmin, c.getGastoById)
router.post('/', soloAdmin, gastoRules, validate, c.createGasto)
router.put('/:id', soloAdmin, gastoRules, validate, c.updateGasto)
router.delete('/:id', soloAdmin, c.deleteGasto)

module.exports = router