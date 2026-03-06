const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data.sqlite');

db.all('SELECT id, full_name, email, role, department FROM users ORDER BY id', [], (err, rows) => {
  if(err) {
    console.error('Error:', err);
  } else {
    console.log('Total users:', rows.length);
    rows.forEach(r => {
      console.log(`ID ${r.id}: ${r.full_name.padEnd(25)} | ${r.email.padEnd(35)} | ${r.role.padEnd(10)} | ${r.department || 'N/A'}`);
    });
  }
  db.close();
});
