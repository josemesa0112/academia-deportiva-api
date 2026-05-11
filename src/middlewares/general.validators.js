const { body } = require('express-validator')

const profesorRules = [
  body('id_persona')
    .notEmpty().withMessage('La persona es obligatoria')
    .isInt({ min: 1 }).withMessage('El id de persona debe ser un número válido'),
  body('salario')
    .notEmpty().withMessage('El salario es obligatorio')
    .isDecimal().withMessage('El salario debe ser un número decimal válido'),
  body('id_estado')
    .notEmpty().withMessage('El estado es obligatorio')
    .isInt({ min: 1 }).withMessage('El estado debe ser un número válido')
]

const deportistaRules = [
  body('id_persona')
    .notEmpty().withMessage('La persona es obligatoria')
    .isInt({ min: 1 }).withMessage('El id de persona debe ser un número válido'),
  body('peso_actual')
    .notEmpty().withMessage('El peso es obligatorio')
    .isDecimal().withMessage('El peso debe ser un número decimal válido'),
  body('estatura_actual')
    .notEmpty().withMessage('La estatura es obligatoria')
    .isDecimal().withMessage('La estatura debe ser un número decimal válido'),
  body('id_categoria')
    .notEmpty().withMessage('La categoría es obligatoria')
    .isInt({ min: 1 }).withMessage('La categoría debe ser un número válido'),
  body('id_estado')
    .notEmpty().withMessage('El estado es obligatorio')
    .isInt({ min: 1 }).withMessage('El estado debe ser un número válido')
]

const productoRules = [
  body('nombre_producto')
    .trim().notEmpty().withMessage('El nombre del producto es obligatorio')
    .isLength({ max: 200 }).withMessage('El nombre no puede superar 200 caracteres'),
  body('id_tipo_producto')
    .notEmpty().withMessage('El tipo de producto es obligatorio')
    .isInt({ min: 1 }).withMessage('El tipo de producto debe ser un número válido'),
  body('precio_producto')
    .notEmpty().withMessage('El precio es obligatorio')
    .isDecimal().withMessage('El precio debe ser un número decimal válido')
]

const canchaRules = [
  body('nombre')
    .trim().notEmpty().withMessage('El nombre de la cancha es obligatorio')
    .isLength({ max: 150 }).withMessage('El nombre no puede superar 150 caracteres'),
  body('id_estado')
    .notEmpty().withMessage('El estado es obligatorio')
    .isInt({ min: 1 }).withMessage('El estado debe ser un número válido')
]

const entrenamientoRules = [
  body('id_cancha')
    .notEmpty().withMessage('La cancha es obligatoria')
    .isInt({ min: 1 }).withMessage('El id de cancha debe ser un número válido'),
  body('id_categoria')
    .notEmpty().withMessage('La categoría es obligatoria')
    .isInt({ min: 1 }).withMessage('El id de categoría debe ser un número válido'),
  body('hora_inicio')
  .notEmpty().withMessage('La hora de inicio es obligatoria')
  .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('La hora debe tener formato HH:MM'),
  body('hora_fin')
  .notEmpty().withMessage('La hora de fin es obligatoria')
  .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('La hora debe tener formato HH:MM'),
  body('fecha')
    .notEmpty().withMessage('La fecha es obligatoria')
    .isDate().withMessage('La fecha debe tener formato YYYY-MM-DD'),
  body('id_estado')
    .notEmpty().withMessage('El estado es obligatorio')
    .isInt({ min: 1 }).withMessage('El estado debe ser un número válido')
]

const matriculaRules = [
  body('id_deportista')
    .notEmpty().withMessage('El deportista es obligatorio')
    .isInt({ min: 1 }).withMessage('El id de deportista debe ser un número válido'),
  body('fecha_inicio')
    .notEmpty().withMessage('La fecha de inicio es obligatoria')
    .isDate().withMessage('La fecha debe tener formato YYYY-MM-DD'),
  body('valor')
    .notEmpty().withMessage('El valor es obligatorio')
    .isDecimal().withMessage('El valor debe ser un número decimal válido'),
  body('id_categoria')
    .notEmpty().withMessage('La categoría es obligatoria')
    .isInt({ min: 1 }).withMessage('La categoría debe ser un número válido'),
  body('id_estado')
    .notEmpty().withMessage('El estado es obligatorio')
    .isInt({ min: 1 }).withMessage('El estado debe ser un número válido')
]

const mensualidadRules = [
  body('id_deportista')
    .notEmpty().withMessage('El deportista es obligatorio')
    .isInt({ min: 1 }).withMessage('El id de deportista debe ser un número válido'),
  body('mes')
    .notEmpty().withMessage('El mes es obligatorio')
    .isInt({ min: 1, max: 12 }).withMessage('El mes debe ser un número entre 1 y 12'),
  body('año')
    .notEmpty().withMessage('El año es obligatorio')
    .isInt({ min: 2000 }).withMessage('El año debe ser un número válido'),
  body('valor')
    .notEmpty().withMessage('El valor es obligatorio')
    .isDecimal().withMessage('El valor debe ser un número decimal válido'),
  body('id_estado')
    .notEmpty().withMessage('El estado es obligatorio')
    .isInt({ min: 1 }).withMessage('El estado debe ser un número válido')
]

module.exports = {
  profesorRules, deportistaRules, productoRules,
  canchaRules, entrenamientoRules, matriculaRules, mensualidadRules
}