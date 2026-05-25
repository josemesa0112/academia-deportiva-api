const q = require('../queries/medicion.queries')

const getMediciones = async (req, res) => {
  try {
    const { rows } = await q.getMedicionesByDeportista(req.params.id)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getPosiciones = async (req, res) => {
  try {
    const { rows } = await q.getPosicionesByDeportista(req.params.id)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getMediciones, getPosiciones }
