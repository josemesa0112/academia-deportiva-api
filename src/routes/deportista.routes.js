const router = require('express').Router()
const c = require('../controllers/deportista.controller')
const m = require('../controllers/medicion.controller')
const { deportistaRules } = require('../middlewares/general.validators')
const validate = require('../middlewares/validate')

router.get('/', c.getDeportistas)
router.get('/categoria/:id_categoria', c.getDeportistasByCategoria)
router.get('/:id/mediciones', m.getMediciones)
router.get('/:id/posiciones', m.getPosiciones)
router.get('/:id', c.getDeportistaById)
router.post('/', deportistaRules, validate, c.createDeportista)
router.put('/:id', deportistaRules, validate, c.updateDeportista)
router.delete('/:id', c.deleteDeportista)

module.exports = router