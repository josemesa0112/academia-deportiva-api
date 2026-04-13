const router = require('express').Router()
const c = require('../controllers/producto.controller')

router.get('/', c.getProductos)
router.get('/:id', c.getProductoById)
router.post('/', c.createProducto)
router.put('/:id', c.updateProducto)
router.delete('/:id', c.deleteProducto)

module.exports = router