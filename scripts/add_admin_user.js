// Script to add admin user
const db = require('../db');
const bcrypt = require('bcryptjs');

async function main() {
  const hash = bcrypt.hashSync('1234', 10);
  const user = ['Admin User', 'automation@maishabank.com', hash, 'admin', 'Admin', 'male'];
  const exists = await db.query("SELECT id FROM users WHERE email = @p0", [user[1]]);
  if (exists.recordset.length === 0) {
    await db.query("INSERT INTO users (full_name, email, password_hash, role, department, gender) VALUES (@p0, @p1, @p2, @p3, @p4, @p5)", user);
    console.log('Admin user added.');
  } else {
    console.log('Admin user already exists.');
  }
}

main().catch(console.error);