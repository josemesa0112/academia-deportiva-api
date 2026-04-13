const router = require('express').Router()
const c = require('../controllers/deportista.controller')

router.get('/', c.getDeportistas)
router.get('/:id', c.getDeportistaById)
router.post('/', c.createDeportista)
router.put('/:id', c.updateDeportista)
router.delete('/:id', c.deleteDeportista)

module.exports = router