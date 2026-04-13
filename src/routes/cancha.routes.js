const router = require('express').Router()
const c = require('../controllers/cancha.controller')

router.get('/', c.getCanchas)
router.get('/:id', c.getCanchaById)
router.post('/', c.createCancha)
router.put('/:id', c.updateCancha)
router.delete('/:id', c.deleteCancha)

module.exports = router