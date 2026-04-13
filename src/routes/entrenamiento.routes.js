const router = require('express').Router()
const c = require('../controllers/entrenamiento.controller')

router.get('/', c.getEntrenamientos)
router.get('/:id', c.getEntrenamientoById)
router.post('/', c.createEntrenamiento)
router.put('/:id', c.updateEntrenamiento)
router.delete('/:id', c.deleteEntrenamiento)
router.post('/profesores', c.addProfesorToEntrenamiento)
router.delete('/profesores/:id', c.removeProfesorFromEntrenamiento)

module.exports = router