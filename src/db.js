const { Pool } = require('pg')
// Ver nota en index.js sobre override.
require('dotenv').config({ override: true })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

pool.connect()
  .then(() => console.log('Conectado a Supabase PostgreSQL'))
  .catch(err => console.error('Error de conexión:', err))

module.exports = pool