const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

const demoData = {
  'Sales': {
    hod: { name: 'Sarah Smith', email: 'sarah.smith@example.com' },
    employees: [
      { name: 'John Demo', email: 'john.demo@example.com' }
    ]
  },
  'Operations': {
    hod: { name: 'Michael Johnson', email: 'michael.johnson@example.com' },
    employees: [
      { name: 'Jane Demo', email: 'jane.demo@example.com' }
    ]
  }
};

function initBalancesForUser(userId, callback) {
  db.all(`SELECT id, default_days FROM leave_types`, [], (e, types) => {
    if (e) return callback(e);
    const ins = db.prepare(`INSERT OR REPLACE INTO user_leave_balances(user_id,leave_type_id,remaining_days) VALUES(?,?,?)`);
    types.forEach(t => ins.run(userId, t.id, t.default_days));
    ins.finalize(() => callback(null));
  });
}

const pwd = bcrypt.hashSync('1234', 10);
let completed = 0;
let total = 0;

Object.keys(demoData).forEach(deptName => {
  total += 1 + demoData[deptName].employees.length;
});

Object.keys(demoData).forEach(deptName => {
  const hodInfo = demoData[deptName];
  
  // Create HOD
  db.get(`SELECT id FROM users WHERE email = ?`, [hodInfo.hod.email], (err, existing) => {
    if (!existing) {
      db.run(
        `INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`,
        [hodInfo.hod.name, hodInfo.hod.email, pwd, 'HOD', deptName],
        function(errorHod) {
          if (errorHod) {
            completed++;
            if (completed === total) finish();
            return;
          }
          const hodId = this.lastID;
          
          // Update or create department
          db.run(
            `INSERT OR REPLACE INTO departments(name, hod_user_id) VALUES(?,?)`,
            [deptName, hodId],
            (deptErr) => {
              initBalancesForUser(hodId, () => {
                console.log(`✓ Created HOD: ${hodInfo.hod.name} for ${deptName}`);
                completed++;
                if (completed === total) finish();
              });
            }
          );
        }
      );
    } else {
      console.log(`✓ HOD already exists: ${hodInfo.hod.email}`);
      completed++;
      if (completed === total) finish();
    }
  });
  
  // Create employees
  hodInfo.employees.forEach(emp => {
    db.get(`SELECT id FROM users WHERE email = ?`, [emp.email], (err, existing) => {
      if (!existing) {
        db.run(
          `INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`,
          [emp.name, emp.email, pwd, 'employee', deptName],
          function(errorEmp) {
            if (errorEmp) {
              completed++;
              if (completed === total) finish();
              return;
            }
            initBalancesForUser(this.lastID, () => {
              console.log(`✓ Created Employee: ${emp.name} in ${deptName}`);
              completed++;
              if (completed === total) finish();
            });
          }
        );
      } else {
        console.log(`✓ Employee already exists: ${emp.email}`);
        completed++;
        if (completed === total) finish();
      }
    });
  });
});

function finish() {
  console.log('\n✅ Demo data setup complete!');
  console.log('\n📋 Demo Credentials (password: 1234):');
  console.log('\n🏢 Sales Department:');
  console.log('  HOD: sarah.smith@example.com');
  console.log('  Employee: john.demo@example.com');
  console.log('\n🏢 Operations Department:');
  console.log('  HOD: michael.johnson@example.com');
  console.log('  Employee: jane.demo@example.com');
  db.close();
  process.exit(0);
}
