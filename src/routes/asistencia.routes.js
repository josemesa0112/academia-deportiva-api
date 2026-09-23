const router = require('express').Router()
const c = require('../controllers/asistencia.controller')
const { requireRol } = require('../middlewares/requireAuth')

// El deportista (rol 3) y el proveedor (rol 4) solo leen: no pueden crear,
// editar ni borrar nada. Se aplica en el servidor y no solo ocultando
// botones, porque un token válido basta para llamar al endpoint.
const puedeEscribir = requireRol(1, 2)

router.get('/', c.getAsistencias)
router.get('/:id', c.getAsistenciaById)
router.get('/entrenamiento/:id_entrenamiento', c.getAsistenciasByEntrenamiento)
router.get('/deportista/:id_deportista', c.getAsistenciasByDeportista)
router.post('/', puedeEscribir, c.createAsistencia)
router.put('/:id', puedeEscribir, c.updateAsistencia)
router.delete('/:id', puedeEscribir, c.deleteAsistencia)

module.exports = router