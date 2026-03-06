const { Pool } = require('pg');

async function run() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    console.error('No DATABASE_URL');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: conn });
  try {
    // drop in order to avoid FK issues
    await pool.query('DROP TABLE IF EXISTS audit_logs');
    await pool.query('DROP TABLE IF EXISTS leave_requests');
    await pool.query('DROP TABLE IF EXISTS balance');
    await pool.query('DROP TABLE IF EXISTS leave_type');
    await pool.query('DROP TABLE IF EXISTS department');
    await pool.query('DROP TABLE IF EXISTS users');
    console.log('Dropped legacy tables');
  } catch (err) {
    console.error('ERR', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
