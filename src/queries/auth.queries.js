const pool = require('../db')

// Persona por documento. Es la identidad de ingreso: numero_documento tiene
// constraint UNIQUE, así que como máximo devuelve una fila.
const getPersonaPorDocumento = (documento) =>
  pool.query(
    `SELECT p.id, p.nombre, p.apellido, p.correo, p.numero_documento,
            p.numero_telefono, p.id_rol, p.id_estado, p.debe_cambiar_password,
            r.nombre_rol
       FROM tbd_persona p
       LEFT JOIN tbd_rol r ON r.id = p.id_rol
      WHERE p.numero_documento = $1`,
    [documento]
  )

const getPersonaPorCorreo = (correo) =>
  pool.query(
    `SELECT id, nombre, apellido, correo, numero_documento, id_rol, id_estado,
            debe_cambiar_password
       FROM tbd_persona
      WHERE lower(correo) = lower($1)`,
    [correo]
  )

const marcarPasswordCambiada = (idPersona) =>
  pool.query(
    `UPDATE tbd_persona SET debe_cambiar_password = FALSE WHERE id = $1 RETURNING id`,
    [idPersona]
  )

// Invalida los códigos vigentes de la persona antes de emitir uno nuevo,
// para que solo el último sirva.
const invalidarCodigosPrevios = (idPersona) =>
  pool.query(
    `UPDATE tbd_codigo_verificacion
        SET usado_en = NOW()
      WHERE id_persona = $1 AND usado_en IS NULL`,
    [idPersona]
  )

const crearCodigo = ({ idPersona, codigoHash, canal, destino, minutosVigencia }) =>
  pool.query(
    `INSERT INTO tbd_codigo_verificacion (id_persona, codigo_hash, canal, destino, expira_en)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval)
     RETURNING id, expira_en`,
    [idPersona, codigoHash, canal, destino, String(minutosVigencia)]
  )

// Último código sin usar de la persona.
const getCodigoVigente = (idPersona) =>
  pool.query(
    `SELECT id, codigo_hash, expira_en, intentos
       FROM tbd_codigo_verificacion
      WHERE id_persona = $1 AND usado_en IS NULL
      ORDER BY creado_en DESC
      LIMIT 1`,
    [idPersona]
  )

const sumarIntento = (idCodigo) =>
  pool.query(
    `UPDATE tbd_codigo_verificacion SET intentos = intentos + 1
      WHERE id = $1 RETURNING intentos`,
    [idCodigo]
  )

const marcarCodigoUsado = (idCodigo) =>
  pool.query(
    `UPDATE tbd_codigo_verificacion SET usado_en = NOW() WHERE id = $1`,
    [idCodigo]
  )

module.exports = {
  getPersonaPorDocumento,
  getPersonaPorCorreo,
  marcarPasswordCambiada,
  invalidarCodigosPrevios,
  crearCodigo,
  getCodigoVigente,
  sumarIntento,
  marcarCodigoUsado,
}