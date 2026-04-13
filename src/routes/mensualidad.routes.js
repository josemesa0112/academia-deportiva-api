const router = require('express').Router()
const c = require('../controllers/mensualidad.controller')

router.get('/', c.getMensualidades)
router.get('/:id', c.getMensualidadById)
router.get('/deportista/:id_deportista', c.getMensualidadesByDeportista)
router.post('/', c.createMensualidad)
router.put('/:id', c.updateMensualidad)
router.delete('/:id', c.deleteMensualidad)

module.exports = router