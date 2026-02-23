const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('Checking all departments with HODs and employees:\n');

db.all(`
  SELECT 
    d.name as department,
    COUNT(CASE WHEN u.role = 'HOD' THEN 1 END) as hod_count,
    COUNT(CASE WHEN u.role = 'employee' THEN 1 END) as employee_count,
    GROUP_CONCAT(CASE WHEN u.role = 'HOD' THEN u.email END) as hod_email,
    GROUP_CONCAT(CASE WHEN u.role = 'employee' THEN u.email END) as employee_emails
  FROM departments d
  LEFT JOIN users u ON u.department = d.name
  GROUP BY d.name
  ORDER BY d.name
`, [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  if (rows && rows.length > 0) {
    rows.forEach(row => {
      console.log(`📦 Department: ${row.department}`);
      console.log(`   HODs: ${row.hod_email || '(none)'}`);
      console.log(`   Employees: ${row.employee_emails || '(none)'}\n`);
    });
  } else {
    console.log('No departments found');
  }

  db.close();
  process.exit(0);
});
