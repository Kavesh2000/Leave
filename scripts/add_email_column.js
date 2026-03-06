const { query, initPool } = require('../db');

async function addEmailColumn() {
  try {
    await initPool();
    await query("ALTER TABLE dbo.users ADD email NVARCHAR(200) NULL;");
    console.log('Added email column to users table.');
  } catch (err) {
    console.error('Error adding email column:', err);
  }
}

if (require.main === module) {
  addEmailColumn();
}
