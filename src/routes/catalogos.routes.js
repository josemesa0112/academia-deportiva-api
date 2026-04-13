const router = require('express').Router()
const c = require('../controllers/catalogos.controller')

router.get('/estados', c.getEstados)
router.get('/roles', c.getRoles)
router.get('/generos', c.getGeneros)
router.get('/tipos-documento', c.getTiposDocumento)
router.get('/clasificaciones', c.getClasificaciones)
router.get('/categorias', c.getCategorias)
router.get('/posiciones', c.getPosiciones)
router.get('/tipos-producto', c.getTiposProducto)
router.get('/variantes-producto', c.getVariantesProducto)

module.exports = router