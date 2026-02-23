const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

const newPassword = '1234';
const hashedPassword = bcrypt.hashSync(newPassword, 10);

db.run(`UPDATE users SET password_hash = ?`, [hashedPassword], function(err) {
  if (err) {
    console.error('Error updating passwords:', err);
    process.exit(1);
  }
  
  console.log(`✓ Updated ${this.changes} users with password: ${newPassword}`);
  db.close();
  process.exit(0);
});
