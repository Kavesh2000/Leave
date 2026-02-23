const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.all(`SELECT id, full_name, email, password_hash FROM users LIMIT 5`, [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('First 5 users:');
  rows.forEach(u => {
    console.log(`\nID: ${u.id}, Name: ${u.full_name}, Email: ${u.email}`);
    console.log(`Password hash: ${u.password_hash.substring(0, 30)}...`);
    
    // Test if password "1234" matches
    const matches = bcrypt.compareSync('1234', u.password_hash);
    console.log(`Password "1234" matches: ${matches}`);
  });
  
  db.close();
  process.exit(0);
});
