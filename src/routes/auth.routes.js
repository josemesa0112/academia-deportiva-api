const router = require('express').Router()
const c = require('../controllers/auth.controller')
const { requireAuth } = require('../middlewares/requireAuth')

// Públicas: son justamente las que permiten obtener una sesión.
router.post('/login-documento', c.loginDocumento)
router.post('/recuperar/solicitar', c.solicitarCodigo)
router.post('/recuperar/verificar', c.verificarCodigoYRestablecer)

// Requieren sesión.
router.get('/yo', requireAuth, c.yo)
router.post('/cambiar-password', requireAuth, c.cambiarPassword)

module.exports = router