const router = require('express').Router()
const c = require('../controllers/proveedor.controller')

router.get('/', c.getProveedores)
router.get('/:id', c.getProveedorById)
router.post('/', c.createProveedor)
router.put('/:id', c.updateProveedor)
router.delete('/:id', c.deleteProveedor)

module.exports = router