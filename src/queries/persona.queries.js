const pool = require('../db')

const getPersonas = () => pool.query(`
  SELECT p.*, r.nombre_rol, g.nombre_genero, td.nombre AS tipo_documento, e.nombre AS estado
  FROM tbd_persona p
  LEFT JOIN tbd_rol r ON p.id_rol = r.id
  LEFT JOIN tbd_genero g ON p.id_genero = g.id
  LEFT JOIN tbd_tipo_documento td ON p.id_tipo_documento = td.id
  LEFT JOIN tbd_estado e ON p.id_estado = e.id
  ORDER BY p.id
`)

const getPersonaById = (id) => pool.query(`
  SELECT p.*, r.nombre_rol, g.nombre_genero, td.nombre AS tipo_documento, e.nombre AS estado
  FROM tbd_persona p
  LEFT JOIN tbd_rol r ON p.id_rol = r.id
  LEFT JOIN tbd_genero g ON p.id_genero = g.id
  LEFT JOIN tbd_tipo_documento td ON p.id_tipo_documento = td.id
  LEFT JOIN tbd_estado e ON p.id_estado = e.id
  WHERE p.id = $1
`, [id])

// Convierte valores que pueden venir como "true"/"false" string, "1"/"0", boolean
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1'

// Si es empresa, los campos de persona natural se fuerzan a NULL
// para mantener consistencia (no quedan valores residuales del form).
const normalizePersonaData = (data) => {
  const esEmpresa = toBool(data.es_empresa)
  return {
    nombre: data.nombre,
    apellido: esEmpresa ? null : (data.apellido || null),
    fecha_nacimiento: esEmpresa ? null : (data.fecha_nacimiento || null),
    correo: data.correo || null,
    id_rol: data.id_rol,
    numero_telefono: data.numero_telefono || null,
    id_genero: esEmpresa ? null : (data.id_genero || null),
    id_tipo_documento: data.id_tipo_documento,
    numero_documento: data.numero_documento,
    id_estado: data.id_estado,
    es_empresa: esEmpresa,
  }
}

const createPersona = (data) => {
  const d = normalizePersonaData(data)
  return pool.query(`
    INSERT INTO tbd_persona
      (nombre, apellido, fecha_nacimiento, correo, id_rol, numero_telefono,
       id_genero, id_tipo_documento, numero_documento, id_estado, es_empresa)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    d.nombre, d.apellido, d.fecha_nacimiento, d.correo,
    d.id_rol, d.numero_telefono, d.id_genero,
    d.id_tipo_documento, d.numero_documento, d.id_estado, d.es_empresa
  ])
}

const updatePersona = (id, data) => {
  const d = normalizePersonaData(data)
  return pool.query(`
    UPDATE tbd_persona SET
      nombre = $1, apellido = $2, fecha_nacimiento = $3, correo = $4,
      id_rol = $5, numero_telefono = $6, id_genero = $7,
      id_tipo_documento = $8, numero_documento = $9, id_estado = $10,
      es_empresa = $11
    WHERE id = $12
    RETURNING *
  `, [
    d.nombre, d.apellido, d.fecha_nacimiento, d.correo,
    d.id_rol, d.numero_telefono, d.id_genero,
    d.id_tipo_documento, d.numero_documento, d.id_estado, d.es_empresa, id
  ])
}

const deletePersona = (id) => pool.query(`
  UPDATE tbd_persona SET id_estado = 2 WHERE id = $1 RETURNING *
`, [id])

// Devuelve la persona y, según el rol:
//   - Profesor (r.id = 2): array `profesor_categorias` con sus categorías.
//   - Deportista (r.id = 3): objeto `deportista_info` con su id, id_categoria
//     y nombre de categoría — el frontend lo usa para filtros y para
//     redirigir "Mi Perfil" a /deportistas/:id automáticamente.
const getPersonaByCorreo = (correo) => pool.query(`
  SELECT p.*, r.nombre_rol, e.nombre AS estado,
    CASE WHEN r.id = 2 THEN (
      SELECT COALESCE(
        json_agg(json_build_object('id', cat.id, 'nombre', cat.nombre) ORDER BY cat.id),
        '[]'::json
      )
      FROM tbd_profesor pr
      JOIN tbd_profesor_x_categoria pxc ON pxc.id_profesor = pr.id
      JOIN tbd_categoria cat ON cat.id = pxc.id_categoria
      WHERE pr.id_persona = p.id
    ) END AS profesor_categorias,
    CASE WHEN r.id = 3 THEN (
      SELECT json_build_object(
        'id', d.id,
        'id_categoria', d.id_categoria,
        'categoria', cat.nombre
      )
      FROM tbd_deportista d
      LEFT JOIN tbd_categoria cat ON cat.id = d.id_categoria
      WHERE d.id_persona = p.id
      LIMIT 1
    ) END AS deportista_info
  FROM tbd_persona p
  LEFT JOIN tbd_rol r ON p.id_rol = r.id
  LEFT JOIN tbd_estado e ON p.id_estado = e.id
  WHERE p.correo = $1 AND p.id_estado = 1
`, [correo])

module.exports = { getPersonas, getPersonaById, createPersona, updatePersona, deletePersona, getPersonaByCorreo }