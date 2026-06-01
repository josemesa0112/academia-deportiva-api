const { body } = require('express-validator')
const pool = require('../db')

// Detecta si el body indica una empresa (acepta true/'true'/1)
const esEmpresa = (req) =>
  req.body?.es_empresa === true ||
  req.body?.es_empresa === 'true' ||
  req.body?.es_empresa === 1 ||
  req.body?.es_empresa === '1'

const personaRules = [
  // Nombre: obligatorio siempre. Para personas naturales se exige solo letras;
  // para empresas se permite cualquier caracter (razón social puede tener
  // puntos, números, "S.A.S.", etc.).
  body('nombre')
    .trim().notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ max: 150 }).withMessage('El nombre no puede superar 150 caracteres'),

  body('nombre')
    .if((_v, { req }) => !esEmpresa(req))
    .isAlpha('es-ES', { ignore: ' ' }).withMessage('El nombre solo debe contener letras'),

  // Apellido: solo obligatorio para personas naturales
  body('apellido')
    .if((_v, { req }) => !esEmpresa(req))
    .trim().notEmpty().withMessage('El apellido es obligatorio')
    .isAlpha('es-ES', { ignore: ' ' }).withMessage('El apellido solo debe contener letras')
    .isLength({ max: 150 }).withMessage('El apellido no puede superar 150 caracteres'),

  body('correo')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail().withMessage('El correo no tiene un formato válido')
    .isLength({ max: 200 }).withMessage('El correo no puede superar 200 caracteres'),

  // Fecha de nacimiento: opcional siempre, pero ignorada si es empresa
  body('fecha_nacimiento')
    .optional({ nullable: true, checkFalsy: true })
    .isDate().withMessage('La fecha de nacimiento debe tener formato YYYY-MM-DD'),

  body('numero_telefono')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone().withMessage('El número de teléfono no es válido'),

  body('numero_documento')
    .trim().notEmpty().withMessage('El número de documento es obligatorio')
    .isLength({ max: 20 }).withMessage('El documento no puede superar 20 caracteres'),

  body('id_rol')
    .notEmpty().withMessage('El rol es obligatorio')
    .isInt({ min: 1 }).withMessage('El rol debe ser un número válido'),

  // Género: solo obligatorio para personas naturales
  body('id_genero')
    .if((_v, { req }) => !esEmpresa(req))
    .notEmpty().withMessage('El género es obligatorio')
    .isInt({ min: 1 }).withMessage('El género debe ser un número válido'),

  body('id_tipo_documento')
    .notEmpty().withMessage('El tipo de documento es obligatorio')
    .isInt({ min: 1 }).withMessage('El tipo de documento debe ser un número válido'),

  body('id_estado')
    .notEmpty().withMessage('El estado es obligatorio')
    .isInt({ min: 1 }).withMessage('El estado debe ser un número válido'),

  // Validación: documento único por tipo
  body('numero_documento').custom(async (value, { req }) => {
    const id = req.params?.id
    const { id_tipo_documento } = req.body
    const query = id
      ? 'SELECT id FROM tbd_persona WHERE numero_documento = $1 AND id_tipo_documento = $2 AND id != $3'
      : 'SELECT id FROM tbd_persona WHERE numero_documento = $1 AND id_tipo_documento = $2'
    const params = id ? [value, id_tipo_documento, id] : [value, id_tipo_documento]
    const { rows } = await pool.query(query, params)
    if (rows.length > 0) throw new Error('Ya existe una persona con ese tipo y número de documento')
    return true
  }),

  // Validación: un solo rol por persona
  body('id_rol').custom(async (value, { req }) => {
    const id = req.params?.id
    const query = id
      ? 'SELECT id FROM tbd_persona WHERE id_rol = $1 AND numero_documento = $2 AND id != $3'
      : 'SELECT id FROM tbd_persona WHERE id_rol = $1 AND numero_documento = $2'
    const { numero_documento } = req.body
    const params = id ? [value, numero_documento, id] : [value, numero_documento]
    const { rows } = await pool.query(query, params)
    if (rows.length > 0) throw new Error('Esta persona ya tiene un rol asignado en el sistema')
    return true
  })
]

module.exports = { personaRules }
