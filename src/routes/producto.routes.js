const router = require('express').Router()
const c = require('../controllers/producto.controller')
const { productoRules } = require('../middlewares/general.validators')
const validate = require('../middlewares/validate')

router.get('/', c.getProductos)
router.get('/:id/precios', c.getPreciosHistoricos)
router.get('/:id', c.getProductoById)
router.post('/', productoRules, validate, c.createProducto)
router.put('/:id', productoRules, validate, c.updateProducto)
router.delete('/:id', c.deleteProducto)

module.exports = router