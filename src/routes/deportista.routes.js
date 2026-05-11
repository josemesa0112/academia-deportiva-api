const router = require('express').Router()
const c = require('../controllers/deportista.controller')
const { deportistaRules } = require('../middlewares/general.validators')
const validate = require('../middlewares/validate')

router.get('/', c.getDeportistas)
router.get('/:id', c.getDeportistaById)
router.post('/', deportistaRules, validate, c.createDeportista)
router.put('/:id', deportistaRules, validate, c.updateDeportista)
router.delete('/:id', c.deleteDeportista)
router.get('/categoria/:id_categoria', c.getDeportistasByCategoria)

module.exports = router