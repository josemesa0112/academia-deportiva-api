const router = require('express').Router()
const c = require('../controllers/persona.controller')
const { personaRules } = require('../middlewares/persona.validators')
const validate = require('../middlewares/validate')
const { requireRol } = require('../middlewares/requireAuth')

// El deportista (rol 3) y el proveedor (rol 4) solo leen: no pueden crear,
// editar ni borrar nada. Se aplica en el servidor y no solo ocultando
// botones, porque un token válido basta para llamar al endpoint.
const puedeEscribir = requireRol(1, 2)

router.get('/', c.getPersonas)
router.get('/:id', c.getPersonaById)
router.post('/', puedeEscribir, personaRules, validate, c.createPersona)
router.put('/:id', puedeEscribir, personaRules, validate, c.updatePersona)
router.delete('/:id', puedeEscribir, c.deletePersona)
router.get('/correo/:correo', c.getPersonaByCorreo)

module.exports = router