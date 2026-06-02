const router = require('express').Router()
const c = require('../controllers/dashboard.controller')

router.get('/resumen', c.getResumen)

module.exports = router
