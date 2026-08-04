const express = require('express')
const cors = require('cors')
const compression = require('compression')
// override: true — el .env del proyecto manda sobre variables de entorno que
// ya existan en la máquina. Sin esto, una variable global con el mismo nombre
// (ej. SUPABASE_URL de otro proyecto) se cuela y apunta la app al lugar
// equivocado. En Render no hay archivo .env, así que no altera producción.
require('dotenv').config({ override: true })
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

const { requireAuth } = require('./src/middlewares/requireAuth')

// --- Rutas públicas -------------------------------------------------------
// Autenticación: son las que permiten obtener una sesión.
app.use('/api/auth', require('./src/routes/auth.routes'))
// Catálogos: datos de referencia sin información personal. La página pública
// de inicio los usa para mostrar las categorías del club.
app.use('/api/catalogos', require('./src/routes/catalogos.routes'))

// --- Rutas protegidas -----------------------------------------------------
// Todo lo que expone datos de personas o del negocio exige sesión válida.
app.use('/api/dashboard', requireAuth, require('./src/routes/dashboard.routes'))
app.use('/api/personas', requireAuth, require('./src/routes/persona.routes'))
app.use('/api/profesores', requireAuth, require('./src/routes/profesor.routes'))
app.use('/api/deportistas', requireAuth, require('./src/routes/deportista.routes'))
app.use('/api/productos', requireAuth, require('./src/routes/producto.routes'))
app.use('/api/proveedores', requireAuth, require('./src/routes/proveedor.routes'))
app.use('/api/compras', requireAuth, require('./src/routes/compra.routes'))
app.use('/api/canchas', requireAuth, require('./src/routes/cancha.routes'))
app.use('/api/entrenamientos', requireAuth, require('./src/routes/entrenamiento.routes'))
app.use('/api/asistencias', requireAuth, require('./src/routes/asistencia.routes'))
app.use('/api/matriculas', requireAuth, require('./src/routes/matricula.routes'))
app.use('/api/mensualidades', requireAuth, require('./src/routes/mensualidad.routes'))



const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})