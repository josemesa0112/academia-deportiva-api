const router = require('express').Router()
const c = require('../controllers/profesor.controller')

router.get('/', c.getProfesores)
router.get('/:id', c.getProfesorById)
router.post('/', c.createProfesor)
router.put('/:id', c.updateProfesor)
router.delete('/:id', c.deleteProfesor)

module.exports = router