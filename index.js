const express = require('express')
const cors = require('cors')
const compression = require('compression')
require('dotenv').config()
require('./src/db')

const app = express()

app.use(compression())
app.use(cors())
app.use(express.json())
app.use(express.static('public'))

// Health endpoint para warm-up (UptimeRobot / GitHub Actions / etc.)
// Respuesta liviana sin tocar DB — solo confirma que el proceso responde.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
})

app.use('/api/catalogos', require('./src/routes/catalogos.routes'))
app.use('/api/personas', require('./src/routes/persona.routes'))
app.use('/api/profesores', require('./src/routes/profesor.routes'))
app.use('/api/deportistas', require('./src/routes/deportista.routes'))
app.use('/api/productos', require('./src/routes/producto.routes'))
app.use('/api/proveedores', require('./src/routes/proveedor.routes'))
app.use('/api/compras', require('./src/routes/compra.routes'))
app.use('/api/canchas', require('./src/routes/cancha.routes'))
app.use('/api/entrenamientos', require('./src/routes/entrenamiento.routes'))
app.use('/api/asistencias', require('./src/routes/asistencia.routes'))
app.use('/api/matriculas', require('./src/routes/matricula.routes'))
app.use('/api/mensualidades', require('./src/routes/mensualidad.routes'))



const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})