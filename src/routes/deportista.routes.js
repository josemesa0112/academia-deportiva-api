const router = require('express').Router()
const c = require('../controllers/deportista.controller')
const m = require('../controllers/medicion.controller')
const { deportistaRules } = require('../middlewares/general.validators')
const validate = require('../middlewares/validate')
const { requireRol } = require('../middlewares/requireAuth')

// El deportista (rol 3) y el proveedor (rol 4) solo leen: no pueden crear,
// editar ni borrar nada. Se aplica en el servidor y no solo ocultando
// botones, porque un token válido basta para llamar al endpoint.
const puedeEscribir = requireRol(1, 2)

router.get('/', c.getDeportistas)
router.get('/categoria/:id_categoria', c.getDeportistasByCategoria)
router.get('/:id/mediciones', m.getMediciones)
router.get('/:id/posiciones', m.getPosiciones)
router.get('/:id', c.getDeportistaById)
router.post('/', puedeEscribir, deportistaRules, validate, c.createDeportista)
router.put('/:id', puedeEscribir, deportistaRules, validate, c.updateDeportista)
router.delete('/:id', puedeEscribir, c.deleteDeportista)

module.exports = router