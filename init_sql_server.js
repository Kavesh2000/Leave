// initializes the SQL Server database with the tables and seed data used by both
// the leave application and audit scripts. Designed to run against the shared
// LeaveApp database on 172.16.200.45 but reads configuration from db.js.

const { query } = require('./db');

async function init() {
  // basic users table for leave app
  await query(`
    IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users;
    CREATE TABLE dbo.users (
      id INT IDENTITY PRIMARY KEY,
      username NVARCHAR(50) UNIQUE NOT NULL,
      password NVARCHAR(255) NOT NULL,
      role NVARCHAR(20) NOT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
  `);

  // audit log that other scripts rely on
  await query(`
    IF OBJECT_ID('dbo.audit_logs', 'U') IS NOT NULL DROP TABLE dbo.audit_logs;
    CREATE TABLE dbo.audit_logs (
      id BIGINT IDENTITY PRIMARY KEY,
      action NVARCHAR(100) NOT NULL,
      user_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
  `);

  // seed a default admin to let us login
  await query(
    `INSERT INTO dbo.users (username,password,role) VALUES (@p0,@p1,@p2);`,
    ['admin', 'password', 'admin']
  );

  console.log('Database initialization complete.');
}

if (require.main === module) {
  init().catch(err => {
    console.error('initialization failed', err);
    process.exit(1);
  });
}
