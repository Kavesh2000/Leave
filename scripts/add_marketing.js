const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

const pwd = bcrypt.hashSync('1234', 10);

// Add Marketing department with HOD and employee
const marketingHod = { name: 'Lisa Marketing', email: 'lisa.marketing@example.com', role: 'HOD' };
const marketingEmployee = { name: 'Tom Employee', email: 'tom.employee@example.com', role: 'employee' };

function initBalancesForUser(userId, callback) {
  db.all(`SELECT id, default_days FROM leave_types`, [], (e, types) => {
    if (e) return callback(e);
    const ins = db.prepare(`INSERT OR REPLACE INTO user_leave_balances(user_id,leave_type_id,remaining_days) VALUES(?,?,?)`);
    types.forEach(t => ins.run(userId, t.id, t.default_days));
    ins.finalize(() => callback(null));
  });
}

let completed = 0;

// Create HOD
db.get(`SELECT id FROM users WHERE email = ?`, [marketingHod.email], (err, existing) => {
  if (!existing) {
    db.run(
      `INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`,
      [marketingHod.name, marketingHod.email, pwd, marketingHod.role, 'Marketing'],
      function(errorHod) {
        if (errorHod) {
          console.log('Error creating HOD:', errorHod);
          completed++;
          return;
        }
        const hodId = this.lastID;
        
        // Create/Update department
        db.run(
          `INSERT OR REPLACE INTO departments(name, hod_user_id) VALUES(?,?)`,
          ['Marketing', hodId],
          (deptErr) => {
            initBalancesForUser(hodId, () => {
              console.log(`✓ Created HOD: ${marketingHod.name} for Marketing`);
              completed++;
              if (completed === 2) finish();
            });
          }
        );
      }
    );
  } else {
    console.log('✓ HOD already exists');
    completed++;
    if (completed === 2) finish();
  }
});

// Create Employee
db.get(`SELECT id FROM users WHERE email = ?`, [marketingEmployee.email], (err, existing) => {
  if (!existing) {
    db.run(
      `INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`,
      [marketingEmployee.name, marketingEmployee.email, pwd, marketingEmployee.role, 'Marketing'],
      function(errorEmp) {
        if (errorEmp) {
          console.log('Error creating Employee:', errorEmp);
          completed++;
          return;
        }
        initBalancesForUser(this.lastID, () => {
          console.log(`✓ Created Employee: ${marketingEmployee.name} in Marketing`);
          completed++;
          if (completed === 2) finish();
        });
      }
    );
  } else {
    console.log('✓ Employee already exists');
    completed++;
    if (completed === 2) finish();
  }
});

function finish() {
  console.log('\n✅ Additional department setup complete!');
  console.log('\n📋 New Demo Credentials (password: 1234):');
  console.log('\n🏢 Marketing Department:');
  console.log(`  HOD: ${marketingHod.email}`);
  console.log(`  Employee: ${marketingEmployee.email}`);
  db.close();
  process.exit(0);
}
