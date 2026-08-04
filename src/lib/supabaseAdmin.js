const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY

// Cliente con service_role: puede crear usuarios y cambiar contraseñas.
// NUNCA debe salir del backend.
const admin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

// Cliente anónimo: se usa solo para validar credenciales (signInWithPassword)
// y para resolver el usuario de un access token.
const anon = url && anonKey
  ? createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

const configurado = Boolean(admin && anon)

// Error explícito en vez de un fallo confuso más adelante.
const exigirConfiguracion = () => {
  if (!configurado) {
    const faltantes = [
      !url && 'SUPABASE_URL',
      !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
      !anonKey && 'SUPABASE_ANON_KEY',
    ].filter(Boolean)
    const err = new Error(
      `Autenticación no configurada. Falta en el .env: ${faltantes.join(', ')}.`
    )
    err.status = 503
    throw err
  }
}

// Busca un usuario de Auth por correo. La API de admin no expone búsqueda
// directa por email, así que se pagina hasta encontrarlo.
const buscarUsuarioPorCorreo = async (correo) => {
  exigirConfiguracion()
  const objetivo = correo.toLowerCase()
  const porPagina = 1000
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: porPagina })
    if (error) throw new Error(error.message)
    const encontrado = data.users.find(u => (u.email || '').toLowerCase() === objetivo)
    if (encontrado) return encontrado
    if (data.users.length < porPagina) return null
  }
  return null
}

module.exports = { admin, anon, configurado, exigirConfiguracion, buscarUsuarioPorCorreo }