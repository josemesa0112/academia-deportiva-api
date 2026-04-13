const router = require('express').Router()
const c = require('../controllers/compra.controller')

router.get('/', c.getCompras)
router.get('/:id', c.getCompraById)
router.post('/', c.createCompra)
router.put('/:id', c.updateCompra)
router.delete('/:id', c.deleteCompra)
router.post('/productos', c.addProductoToCompra)
router.delete('/productos/:id', c.removeProductoFromCompra)

module.exports = router