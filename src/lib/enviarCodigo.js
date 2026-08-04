/**
 * Adaptador de envío del código de verificación.
 *
 * Hoy solo imprime el código en la consola del servidor: los datos de
 * contacto de la base son en su mayoría ficticios (131 de 136 correos son
 * @ejemplo.com), así que no hay a dónde enviarlo de verdad todavía.
 *
 * Para habilitar un canal real basta implementar la función correspondiente
 * y cambiar CANAL. El resto del flujo (generación, expiración, intentos,
 * verificación) no cambia.
 */

const CANAL = process.env.CANAL_CODIGO || 'consola'

// Oculta el destino en las respuestas para no filtrar datos de contacto.
const enmascarar = (valor, tipo) => {
  if (!valor) return null
  if (tipo === 'correo') {
    const [usuario, dominio] = valor.split('@')
    if (!dominio) return '***'
    const visible = usuario.slice(0, 2)
    return `${visible}${'*'.repeat(Math.max(usuario.length - 2, 3))}@${dominio}`
  }
  // Teléfono: solo los últimos 3 dígitos.
  const limpio = String(valor).replace(/\D/g, '')
  return `${'*'.repeat(Math.max(limpio.length - 3, 0))}${limpio.slice(-3)}`
}

const enviarPorConsola = async ({ codigo, persona }) => {
  console.log(
    `[codigo-verificacion] persona=${persona.id} documento=${persona.numero_documento} codigo=${codigo}`
  )
  return { canal: 'consola', destino: 'consola del servidor' }
}

// Punto único de envío. Devuelve el canal usado y el destino enmascarado.
const enviarCodigo = async ({ codigo, persona }) => {
  switch (CANAL) {
    case 'sms':
      // TODO: integrar proveedor (Twilio u otro). Requiere cuenta con saldo y
      // remitente registrado ante los operadores colombianos.
      throw Object.assign(new Error('El envío por SMS aún no está configurado.'), { status: 503 })
    case 'correo':
      // TODO: integrar proveedor de correo (Resend, Brevo, SMTP propio).
      throw Object.assign(new Error('El envío por correo aún no está configurado.'), { status: 503 })
    default:
      return enviarPorConsola({ codigo, persona })
  }
}

module.exports = { enviarCodigo, enmascarar, CANAL }