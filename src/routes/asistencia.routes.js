const router = require('express').Router()
const c = require('../controllers/asistencia.controller')

router.get('/', c.getAsistencias)
router.get('/:id', c.getAsistenciaById)
router.get('/entrenamiento/:id_entrenamiento', c.getAsistenciasByEntrenamiento)
router.get('/deportista/:id_deportista', c.getAsistenciasByDeportista)
router.post('/', c.createAsistencia)
router.put('/:id', c.updateAsistencia)
router.delete('/:id', c.deleteAsistencia)

module.exports = router