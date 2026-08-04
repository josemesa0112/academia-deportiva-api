const q = require('../queries/auth.queries')
const { admin, anon, exigirConfiguracion, buscarUsuarioPorCorreo } = require('../lib/supabaseAdmin')
const { enviarCodigo, enmascarar } = require('../lib/enviarCodigo')
const {
  generarCodigo, hashearCodigo, verificarCodigo,
  MINUTOS_VIGENCIA, MAX_INTENTOS,
} = require('../lib/codigos')

// Mensaje único para credenciales inválidas. No se distingue "documento no
// existe" de "contraseña incorrecta": lo contrario permitiría averiguar qué
// números de documento están registrados en el club probando uno por uno.
const CREDENCIALES_INVALIDAS = 'Documento o contraseña incorrectos.'

const responderError = (res, err) => {
  const status = err?.status || 500
  return res.status(status).json({ error: err?.message || 'Error interno' })
}

// ¿La cuenta de Auth tiene contraseña propia? Un usuario creado por Google
// existe pero solo con identidad OAuth.
//
// Importante: listUsers() NO trae el arreglo `identities`, así que esto debe
// evaluarse siempre sobre el usuario obtenido con getUserById().
const tienePassword = (usuario) =>
  Array.isArray(usuario?.identities) &&
  usuario.identities.some(i => i.provider === 'email')

/**
 * POST /api/auth/login-documento
 * Body: { documento, password }
 *
 * Primer ingreso: la contraseña es el mismo número de documento y la cuenta
 * de Supabase Auth se crea en ese momento. Después, la contraseña es la que
 * la persona haya definido.
 */
const loginDocumento = async (req, res) => {
  try {
    exigirConfiguracion()
    const documento = String(req.body?.documento || '').trim()
    const password = String(req.body?.password || '')
    if (!documento || !password) {
      return res.status(400).json({ error: 'Ingresa tu número de documento y tu contraseña.' })
    }

    const { rows } = await q.getPersonaPorDocumento(documento)
    const persona = rows[0]
    if (!persona) return res.status(401).json({ error: CREDENCIALES_INVALIDAS })

    if (persona.id_estado !== 1) {
      return res.status(403).json({
        error: 'Tu cuenta está inactiva. Contacta al administrador de la academia.',
      })
    }
    if (!persona.correo) {
      return res.status(409).json({
        error: 'Tu registro no tiene correo asociado. Contacta al administrador.',
      })
    }

    // Se intenta primero el ingreso normal. Solo si falla se evalúa si
    // corresponde tratarlo como primer ingreso.
    let { data, error } = await anon.auth.signInWithPassword({
      email: persona.correo,
      password,
    })

    if (error || !data?.session) {
      // El alta con el documento como contraseña SOLO procede si la persona
      // todavía no ha definido la suya (debe_cambiar_password = TRUE). Sin
      // esta condición, cualquiera que conozca un documento podría reescribir
      // la contraseña de esa persona en cualquier momento.
      const esPrimerIngreso =
        persona.debe_cambiar_password === true && password === persona.numero_documento
      if (!esPrimerIngreso) {
        return res.status(401).json({ error: CREDENCIALES_INVALIDAS })
      }

      const usuario = await buscarUsuarioPorCorreo(persona.correo)
      if (!usuario) {
        const { error: errCrear } = await admin.auth.admin.createUser({
          email: persona.correo,
          password,
          email_confirm: true,
          user_metadata: { id_persona: persona.id, numero_documento: persona.numero_documento },
        })
        if (errCrear) {
          return res.status(500).json({ error: `No se pudo crear la cuenta: ${errCrear.message}` })
        }
      } else {
        // La cuenta existe (típicamente creada al entrar con Google). Solo se
        // le asigna contraseña si aún no tiene una.
        const { data: completo } = await admin.auth.admin.getUserById(usuario.id)
        if (tienePassword(completo?.user)) {
          return res.status(401).json({ error: CREDENCIALES_INVALIDAS })
        }
        const { error: errUpd } = await admin.auth.admin.updateUserById(usuario.id, { password })
        if (errUpd) {
          return res.status(500).json({ error: `No se pudo preparar la cuenta: ${errUpd.message}` })
        }
      }

      ;({ data, error } = await anon.auth.signInWithPassword({
        email: persona.correo,
        password,
      }))
      if (error || !data?.session) {
        return res.status(401).json({ error: CREDENCIALES_INVALIDAS })
      }
    }

    return res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      debe_cambiar_password: persona.debe_cambiar_password,
      persona: {
        id: persona.id,
        nombre: persona.nombre,
        apellido: persona.apellido,
        nombre_rol: persona.nombre_rol,
      },
    })
  } catch (err) {
    return responderError(res, err)
  }
}

/**
 * POST /api/auth/cambiar-password   (requiere Bearer token)
 * Body: { password_actual, password_nueva }
 */
const cambiarPassword = async (req, res) => {
  try {
    exigirConfiguracion()
    const actual = String(req.body?.password_actual || '')
    const nueva = String(req.body?.password_nueva || '')
    const persona = req.persona

    if (!actual || !nueva) {
      return res.status(400).json({ error: 'Ingresa tu contraseña actual y la nueva.' })
    }
    if (nueva.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' })
    }
    if (nueva === persona.numero_documento) {
      return res.status(400).json({
        error: 'La contraseña no puede ser tu número de documento.',
      })
    }
    if (nueva === actual) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' })
    }

    // Verifica la contraseña actual intentando iniciar sesión con ella.
    const { error: errorLogin } = await anon.auth.signInWithPassword({
      email: persona.correo,
      password: actual,
    })
    if (errorLogin) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' })
    }

    const { error } = await admin.auth.admin.updateUserById(req.usuarioAuth.id, { password: nueva })
    if (error) return res.status(500).json({ error: `No se pudo actualizar: ${error.message}` })

    await q.marcarPasswordCambiada(persona.id)
    return res.json({ message: 'Contraseña actualizada correctamente.' })
  } catch (err) {
    return responderError(res, err)
  }
}

/**
 * POST /api/auth/recuperar/solicitar
 * Body: { documento }
 *
 * Responde igual exista o no el documento, para no revelar quién está
 * registrado. Si existe, genera y envía un código de 6 dígitos.
 */
const solicitarCodigo = async (req, res) => {
  try {
    const documento = String(req.body?.documento || '').trim()
    if (!documento) return res.status(400).json({ error: 'Ingresa tu número de documento.' })

    const { rows } = await q.getPersonaPorDocumento(documento)
    const persona = rows[0]

    // Respuesta genérica cuando no existe o está inactiva.
    if (!persona || persona.id_estado !== 1) {
      return res.json({
        enviado: true,
        canal: null,
        destino: null,
        mensaje: 'Si el documento está registrado, enviamos un código de verificación.',
      })
    }

    const codigo = generarCodigo()
    const { canal, destino } = await enviarCodigo({ codigo, persona })

    await q.invalidarCodigosPrevios(persona.id)
    const { rows: creado } = await q.crearCodigo({
      idPersona: persona.id,
      codigoHash: hashearCodigo(codigo),
      canal,
      destino,
      minutosVigencia: MINUTOS_VIGENCIA,
    })

    return res.json({
      enviado: true,
      canal,
      destino: canal === 'consola' ? destino : enmascarar(destino, canal),
      expira_en: creado[0].expira_en,
      mensaje: 'Si el documento está registrado, enviamos un código de verificación.',
    })
  } catch (err) {
    return responderError(res, err)
  }
}

/**
 * POST /api/auth/recuperar/verificar
 * Body: { documento, codigo, password_nueva }
 */
const verificarCodigoYRestablecer = async (req, res) => {
  try {
    exigirConfiguracion()
    const documento = String(req.body?.documento || '').trim()
    const codigo = String(req.body?.codigo || '').trim()
    const nueva = String(req.body?.password_nueva || '')

    if (!documento || !codigo || !nueva) {
      return res.status(400).json({ error: 'Faltan datos para restablecer la contraseña.' })
    }
    if (nueva.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' })
    }
    if (nueva === documento) {
      return res.status(400).json({ error: 'La contraseña no puede ser tu número de documento.' })
    }

    const { rows } = await q.getPersonaPorDocumento(documento)
    const persona = rows[0]
    if (!persona || persona.id_estado !== 1) {
      return res.status(400).json({ error: 'Código inválido o vencido.' })
    }

    const { rows: codigos } = await q.getCodigoVigente(persona.id)
    const registro = codigos[0]
    if (!registro) return res.status(400).json({ error: 'Código inválido o vencido.' })

    if (new Date(registro.expira_en) < new Date()) {
      await q.marcarCodigoUsado(registro.id)
      return res.status(400).json({ error: 'El código venció. Solicita uno nuevo.' })
    }
    if (registro.intentos >= MAX_INTENTOS) {
      await q.marcarCodigoUsado(registro.id)
      return res.status(429).json({ error: 'Demasiados intentos. Solicita un código nuevo.' })
    }

    if (!verificarCodigo(codigo, registro.codigo_hash)) {
      const { rows: tras } = await q.sumarIntento(registro.id)
      const restantes = Math.max(MAX_INTENTOS - tras[0].intentos, 0)
      return res.status(400).json({
        error: `Código incorrecto. Te ${restantes === 1 ? 'queda' : 'quedan'} ${restantes} ${restantes === 1 ? 'intento' : 'intentos'}.`,
      })
    }

    await q.marcarCodigoUsado(registro.id)

    if (!persona.correo) {
      return res.status(409).json({
        error: 'Tu registro no tiene correo asociado. Contacta al administrador.',
      })
    }

    // La cuenta de Auth puede no existir todavía si nunca ingresó.
    const usuario = await buscarUsuarioPorCorreo(persona.correo)
    if (!usuario) {
      const { error } = await admin.auth.admin.createUser({
        email: persona.correo,
        password: nueva,
        email_confirm: true,
        user_metadata: { id_persona: persona.id, numero_documento: persona.numero_documento },
      })
      if (error) return res.status(500).json({ error: `No se pudo crear la cuenta: ${error.message}` })
    } else {
      const { error } = await admin.auth.admin.updateUserById(usuario.id, { password: nueva })
      if (error) return res.status(500).json({ error: `No se pudo actualizar: ${error.message}` })
    }

    await q.marcarPasswordCambiada(persona.id)
    return res.json({ message: 'Contraseña restablecida. Ya puedes iniciar sesión.' })
  } catch (err) {
    return responderError(res, err)
  }
}

// GET /api/auth/yo  (requiere Bearer token) — contexto del usuario autenticado.
const yo = async (req, res) => {
  const p = req.persona
  res.json({
    id: p.id,
    nombre: p.nombre,
    apellido: p.apellido,
    correo: p.correo,
    id_rol: p.id_rol,
    id_estado: p.id_estado,
    debe_cambiar_password: p.debe_cambiar_password,
  })
}

module.exports = {
  loginDocumento,
  cambiarPassword,
  solicitarCodigo,
  verificarCodigoYRestablecer,
  yo,
}