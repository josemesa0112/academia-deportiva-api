const pool = require('../db')
const q = require('../queries/persona.queries')

// Traduce errores de PostgreSQL a respuestas HTTP claras. Red de seguridad
// por si la validación del middleware no captura un duplicado (ej. race
// condition en inserts concurrentes).
const handleDbError = (err, res) => {
  if (err.code === '23505' && err.constraint === 'uniq_persona_numero_documento') {
    return res.status(409).json({ error: 'Ya existe una persona con ese número de documento.' })
  }
  return res.status(500).json({ error: err.message })
}

const getPersonas = async (req, res) => {
  try {
    const { rows } = await q.getPersonas()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getPersonaById = async (req, res) => {
  try {
    const { rows } = await q.getPersonaById(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const createPersona = async (req, res) => {
  try {
    const { rows } = await q.createPersona(req.body)
    res.status(201).json(rows[0])
  } catch (err) {
    handleDbError(err, res)
  }
}

const updatePersona = async (req, res) => {
  try {
    const { rows } = await q.updatePersona(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada' })
    res.json(rows[0])
  } catch (err) {
    handleDbError(err, res)
  }
}

const deletePersona = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await q.deletePersonaRow(req.params.id, client)
    if (!rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Persona no encontrada' })
    }

    // Cascade: si esta persona es deportista/profesor/proveedor, también
    // quedan inactivos para que no aparezcan en listados, dropdowns ni KPIs.
    await q.deactivateDerivedByPersona(req.params.id, client)

    await client.query('COMMIT')
    res.json({
      message: 'Persona y sus roles asociados desactivados correctamente',
      data: rows[0],
    })
  } catch (err) {
    await client.query('ROLLBACK')
    handleDbError(err, res)
  } finally {
    client.release()
  }
}

const getPersonaByCorreo = async (req, res) => {
  try {
    // Solo se puede consultar el propio correo. El Administrador puede
    // consultar cualquiera. Sin esta regla, cualquier usuario autenticado
    // podría averiguar el rol de otros probando correos.
    const solicitado = String(req.params.correo || '').toLowerCase()
    const propio = String(req.persona?.correo || '').toLowerCase()
    if (solicitado !== propio && req.persona?.id_rol !== 1) {
      return res.status(403).json({ error: 'No tienes permiso para consultar este correo.' })
    }

    const { rows } = await q.getPersonaByCorreo(req.params.correo)
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getPersonas, getPersonaById, createPersona, updatePersona, deletePersona, getPersonaByCorreo }