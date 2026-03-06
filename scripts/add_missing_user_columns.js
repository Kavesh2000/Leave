const { query, initPool } = require('../db');

async function addMissingColumns() {
  try {
    await initPool();
    await query("ALTER TABLE dbo.users ADD full_name NVARCHAR(200) NULL;");
    await query("ALTER TABLE dbo.users ADD password_hash NVARCHAR(255) NULL;");
    console.log('Added full_name and password_hash columns to users table.');
  } catch (err) {
    console.error('Error adding columns:', err);
  }
}

if (require.main === module) {
  addMissingColumns();
}
