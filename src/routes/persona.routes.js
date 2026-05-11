const router = require('express').Router()
const c = require('../controllers/persona.controller')
const { personaRules } = require('../middlewares/persona.validators')
const validate = require('../middlewares/validate')

router.get('/', c.getPersonas)
router.get('/:id', c.getPersonaById)
router.post('/', personaRules, validate, c.createPersona)
router.put('/:id', personaRules, validate, c.updatePersona)
router.delete('/:id', c.deletePersona)
router.get('/correo/:correo', c.getPersonaByCorreo)

module.exports = router