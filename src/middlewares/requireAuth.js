const { anon, configurado } = require('../lib/supabaseAdmin')
const q = require('../queries/auth.queries')

/**
 * Valida el access token de Supabase que viene en `Authorization: Bearer ...`
 * y resuelve la persona del club a la que corresponde.
 *
 * La validación se hace contra Supabase (`getUser`), lo que cuesta una
 * petición de red. Para no pagarla en cada request se cachea el resultado por
 * token durante TTL_MS. Si más adelante se agrega SUPABASE_JWT_SECRET al .env,
 * esto se puede reemplazar por verificación local de la firma sin tocar el
 * resto del código.
 */
const TTL_MS = 60_000
const cache = new Map() // token -> { expira, usuario, persona }

const limpiarCache = () => {
  const ahora = Date.now()
  for (const [token, entrada] of cache) {
    if (entrada.expira <= ahora) cache.delete(token)
  }
}

const extraerToken = (req) => {
  const header = req.headers.authorization || ''
  const [tipo, valor] = header.split(' ')
  return tipo?.toLowerCase() === 'bearer' && valor ? valor : null
}

const requireAuth = async (req, res, next) => {
  try {
    if (!configurado) {
      return res.status(503).json({ error: 'Autenticación no configurada en el servidor.' })
    }

    const token = extraerToken(req)
    if (!token) {
      return res.status(401).json({ error: 'Se requiere iniciar sesión.' })
    }

    if (cache.size > 500) limpiarCache()
    const enCache = cache.get(token)
    if (enCache && enCache.expira > Date.now()) {
      req.usuarioAuth = enCache.usuario
      req.persona = enCache.persona
      return next()
    }

    const { data, error } = await anon.auth.getUser(token)
    if (error || !data?.user?.email) {
      return res.status(401).json({ error: 'Sesión inválida o vencida.' })
    }

    // El token es válido para Supabase, pero además el correo debe
    // corresponder a una persona registrada y activa del club.
    const { rows } = await q.getPersonaPorCorreo(data.user.email)
    const persona = rows[0]
    if (!persona) {
      return res.status(403).json({ error: 'Este correo no está registrado en la plataforma.' })
    }
    if (persona.id_estado !== 1) {
      return res.status(403).json({ error: 'Tu cuenta está inactiva.' })
    }

    cache.set(token, { expira: Date.now() + TTL_MS, usuario: data.user, persona })
    req.usuarioAuth = data.user
    req.persona = persona
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/** Restringe a los roles indicados. Usar siempre después de requireAuth. */
const requireRol = (...roles) => (req, res, next) => {
  if (!req.persona) {
    return res.status(401).json({ error: 'Se requiere iniciar sesión.' })
  }
  if (!roles.includes(req.persona.id_rol)) {
    return res.status(403).json({ error: 'No tienes permiso para esta acción.' })
  }
  next()
}

module.exports = { requireAuth, requireRol }