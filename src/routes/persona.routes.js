const router = require('express').Router()
const c = require('../controllers/persona.controller')

router.get('/', c.getPersonas)
router.get('/:id', c.getPersonaById)
router.post('/', c.createPersona)
router.put('/:id', c.updatePersona)
router.delete('/:id', c.deletePersona)

module.exports = router