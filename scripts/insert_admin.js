const { query, initPool } = require('../db');
const bcrypt = require('bcryptjs');

async function run() {
  try {
    await initPool();
    const hash = bcrypt.hashSync('1234', 10);
    const now = new Date();
    const r = await query(
      `INSERT INTO users(full_name, email, password, role, is_active, created_at)
       OUTPUT INSERTED.id AS id
       VALUES($1,$2,$3,$4,$5,$6)`,
      ['System Admin', 'automation@maishabank.com', hash, 'admin', 1, now]
    );
    console.log('Inserted admin id', r.recordset[0].id);
  } catch (err) {
    console.error('ERR', err);
    process.exit(1);
  }
}

run();
