const crypto = require('crypto')

const LONGITUD = 6
const MINUTOS_VIGENCIA = 10
const MAX_INTENTOS = 5

// Código numérico de 6 dígitos con aleatoriedad criptográfica (no Math.random).
const generarCodigo = () => {
  const max = 10 ** LONGITUD
  return String(crypto.randomInt(0, max)).padStart(LONGITUD, '0')
}

// El código nunca se guarda en claro. Formato almacenado: "salt:hash".
const hashearCodigo = (codigo) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(codigo, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

// Comparación en tiempo constante para no filtrar información por timing.
const verificarCodigo = (codigo, almacenado) => {
  const [salt, hash] = String(almacenado || '').split(':')
  if (!salt || !hash) return false
  const candidato = crypto.scryptSync(codigo, salt, 32)
  const esperado = Buffer.from(hash, 'hex')
  if (candidato.length !== esperado.length) return false
  return crypto.timingSafeEqual(candidato, esperado)
}

module.exports = { generarCodigo, hashearCodigo, verificarCodigo, LONGITUD, MINUTOS_VIGENCIA, MAX_INTENTOS }