const router = require('express').Router()
const c = require('../controllers/entrenamiento.controller')
const { entrenamientoRules } = require('../middlewares/general.validators')
const validate = require('../middlewares/validate')
const { requireRol } = require('../middlewares/requireAuth')

// El deportista (rol 3) y el proveedor (rol 4) solo leen: no pueden crear,
// editar ni borrar nada. Se aplica en el servidor y no solo ocultando
// botones, porque un token válido basta para llamar al endpoint.
const puedeEscribir = requireRol(1, 2)

router.get('/', c.getEntrenamientos)
router.get('/:id', c.getEntrenamientoById)
router.post('/', puedeEscribir, entrenamientoRules, validate, c.createEntrenamiento)
router.put('/:id', puedeEscribir, entrenamientoRules, validate, c.updateEntrenamiento)
router.delete('/:id', puedeEscribir, c.deleteEntrenamiento)
router.post('/profesores', puedeEscribir, c.addProfesorToEntrenamiento)
router.delete('/profesores/:id', puedeEscribir, c.removeProfesorFromEntrenamiento)

module.exports = router