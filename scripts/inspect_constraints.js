const { Pool } = require('pg');

async function run() {
  const conn = process.env.DATABASE_URL;
  if (!conn) { console.error('No DATABASE_URL'); process.exit(1); }
  const pool = new Pool({ connectionString: conn });
  try {
    const r = await pool.query("SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'users'::regclass");
    console.log('CONSTRAINTS:', JSON.stringify(r.rows, null, 2));
  } catch (err) {
    console.error('ERR', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
