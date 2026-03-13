// Script to add main users back to the system
const db = require('../db');
const bcrypt = require('bcryptjs');

async function main() {
  const hash = bcrypt.hashSync('1234', 10);
  const users = [
    ['Elizabeth Mungai', 'elizabeth.mungai@maishabank.com', hash, 'HR', 'HR', 'female'],
    ['Eric Mokaya', 'eric.mokaya@maishabank.com', hash, 'hod', 'ICT', 'male'],
    ['Clive Odame', 'clive.odame@maishabank.com', hash, 'hod', 'Legal', 'male'],
    ['Bonface Kioko', 'bonface.kioko@maishabank.com', hash, 'hod', 'Security', 'male']
  ];
  for (const u of users) {
    await db.query("INSERT INTO users (full_name, email, password_hash, role, department, gender) VALUES (@p0, @p1, @p2, @p3, @p4, @p5)", u);
  }
  console.log('Core users restored. All passwords set to 1234.');
}

main().catch(console.error);