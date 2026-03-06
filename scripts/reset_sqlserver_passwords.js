const { query, initPool } = require('../db');
const bcrypt = require('bcryptjs');

async function resetAllPasswords() {
  try {
    await initPool();
    const hash = bcrypt.hashSync('1234', 10);
    const result = await query('UPDATE users SET password_hash = @p0', [hash]);
    console.log(`Updated password_hash for all users to '1234'.`);
    process.exit(0);
  } catch (err) {
    console.error('Error resetting passwords:', err);
    process.exit(1);
  }
}

resetAllPasswords();
