const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function run() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: conn });
  try {
    const hash = bcrypt.hashSync('1234', 10);
    const res = await pool.query('UPDATE users SET password_hash=$1', [hash]);
    console.log('Updated password_hash for', res.rowCount, 'users');
  } catch (err) {
    console.error('ERR', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
