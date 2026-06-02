const router = require('express').Router()
const c = require('../controllers/profesor.controller')
const { profesorRules } = require('../middlewares/general.validators')
const validate = require('../middlewares/validate')

router.get('/', c.getProfesores)
router.get('/:id/categorias', c.getCategoriasDelProfesor)
router.get('/:id', c.getProfesorById)
router.post('/', profesorRules, validate, c.createProfesor)
router.put('/:id', profesorRules, validate, c.updateProfesor)
router.delete('/:id', c.deleteProfesor)

module.exports = router