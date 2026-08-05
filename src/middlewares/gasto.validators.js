const { body } = require('express-validator')

const gastoRules = [
  body('concepto')
    .trim().notEmpty().withMessage('El concepto es obligatorio')
    .isLength({ max: 150 }).withMessage('El concepto no puede superar 150 caracteres'),
  body('id_tipo_gasto')
    .notEmpty().withMessage('El tipo de gasto es obligatorio')
    .isInt({ min: 1 }).withMessage('El tipo de gasto debe ser un número válido'),
  body('valor')
    .notEmpty().withMessage('El valor es obligatorio')
    .isDecimal().withMessage('El valor debe ser un número válido')
    .custom(v => Number(v) > 0).withMessage('El valor debe ser mayor que cero'),
  body('fecha')
    .notEmpty().withMessage('La fecha es obligatoria')
    .isISO8601().withMessage('La fecha no tiene un formato válido'),
  body('descripcion')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 1000 }).withMessage('La descripción no puede superar 1000 caracteres'),
]

module.exports = { gastoRules }