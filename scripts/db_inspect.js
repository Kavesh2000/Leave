const { Pool } = require('pg');

async function run() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    console.error('No DATABASE_URL set in environment');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: conn });
  try {
    const cols = await pool.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
    console.log('COLUMNS:', JSON.stringify(cols.rows, null, 2));
    const rows = await pool.query('SELECT * FROM users LIMIT 10');
    console.log('SAMPLE ROWS:', JSON.stringify(rows.rows, null, 2));
  } catch (err) {
    console.error('ERR', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
