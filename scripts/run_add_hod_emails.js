// Node.js script to run add_hod_emails.sql using mssql
const fs = require('fs');
const sql = require('mssql');
require('dotenv').config();

const sqlFile = 'scripts/add_hod_emails.sql';
const sqlText = fs.readFileSync(sqlFile, 'utf8');

const config = {
  user: process.env.DB_USER || 'your_db_user',
  password: process.env.DB_PASS || 'your_db_password',
  server: process.env.DB_SERVER || '172.16.200.45',
  database: process.env.DB_NAME || 'LeaveApp',
  options: {
    encrypt: false, // set to true if using Azure
    trustServerCertificate: true
  }
};

async function run() {
  try {
    await sql.connect(config);
    const statements = sqlText.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      if (stmt) {
        console.log('Running:', stmt.slice(0, 60) + '...');
        await sql.query(stmt);
      }
    }
    console.log('All SQL statements executed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('SQL error:', err);
    process.exit(1);
  }
}

run();
