const router = require('express').Router()
const c = require('../controllers/matricula.controller')

router.get('/', c.getMatriculas)
router.get('/:id', c.getMatriculaById)
router.get('/deportista/:id_deportista', c.getMatriculasByDeportista)
router.post('/', c.createMatricula)
router.put('/:id', c.updateMatricula)
router.delete('/:id', c.deleteMatricula)

module.exports = router