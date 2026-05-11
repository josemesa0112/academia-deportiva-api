const q = require('../queries/persona.queries')

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
    res.status(500).json({ error: err.message })
  }
}

const updatePersona = async (req, res) => {
  try {
    const { rows } = await q.updatePersona(req.params.id, req.body)
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const deletePersona = async (req, res) => {
  try {
    const { rows } = await q.deletePersona(req.params.id)
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada' })
    res.json({ message: 'Persona desactivada correctamente', data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getPersonaByCorreo = async (req, res) => {
  try {
    const { rows } = await q.getPersonaByCorreo(req.params.correo)
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getPersonas, getPersonaById, createPersona, updatePersona, deletePersona, getPersonaByCorreo }