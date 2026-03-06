const { query, initPool } = require('../db');

async function addDepartmentColumn() {
  try {
    await initPool();
    await query("ALTER TABLE dbo.users ADD department NVARCHAR(50) NULL;");
    console.log('Added department column to users table.');
  } catch (err) {
    console.error('Error adding department column:', err);
  }
}

if (require.main === module) {
  addDepartmentColumn();
}
