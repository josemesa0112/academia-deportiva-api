const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true })

const archivo = process.argv[2]
if (!archivo) { console.error('uso: node _migrar.cjs <archivo.sql>'); process.exit(1) }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', archivo), 'utf8')

;(async () => {
  const client = await pool.connect()
  client.on('notice', n => console.log('  NOTICE:', n.message))
  try {
    await client.query(sql)
    console.log('OK migración aplicada:', archivo)
  } finally {
    client.release()
    await pool.end()
  }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })