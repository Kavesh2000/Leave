const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.sqlite');
const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'leave-secret', resave: false, saveUninitialized: false }));

const db = new sqlite3.Database(DB_PATH);

const HOLIDAYS = [
  // ISO dates
  '2026-01-01',
  '2026-12-25'
];

app.get('/api/holidays', (req,res)=>{
  res.json(HOLIDAYS);
});

app.post('/api/calc_days', (req,res)=>{
  const {start_date, end_date} = req.body;
  if(!start_date || !end_date) return res.status(400).json({error:'missing dates'});
  const days = countWorkingDays(start_date, end_date, HOLIDAYS);
  res.json({days});
});

// Admin analytics: leave days per department
app.get('/api/analytics/departments', requireAuth, (req,res)=>{
  if(req.session.role!=='admin') return res.status(403).json({error:'forbidden'});
  db.all(`SELECT u.department as department, SUM(lr.days) as days FROM leave_requests lr JOIN users u ON u.id=lr.user_id WHERE lr.status='admin_approved' GROUP BY u.department`, [], (e,rows)=>{
    res.json(rows || []);
  });
});

app.get('/api/analytics/types', requireAuth, (req,res)=>{
  if(req.session.role!=='admin') return res.status(403).json({error:'forbidden'});
  db.all(`SELECT lt.name as type, SUM(lr.days) as days FROM leave_requests lr JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.status='admin_approved' GROUP BY lt.name`, [], (e,rows)=>{
    res.json(rows || []);
  });
});

function initDb(){
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT,
      department TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS departments(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      hod_user_id INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS leave_types(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      default_days INTEGER,
      editable INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_leave_balances(
      user_id INTEGER,
      leave_type_id INTEGER,
      remaining_days INTEGER,
      PRIMARY KEY(user_id, leave_type_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS leave_requests(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      leave_type_id INTEGER,
      start_date TEXT,
      end_date TEXT,
      days INTEGER,
      reason TEXT,
      status TEXT,
      hod_comment TEXT,
      admin_comment TEXT,
      created_at TEXT,
      updated_at TEXT
    )`);

    // seed leave types
    db.get(`SELECT COUNT(*) as c FROM leave_types`, (err,row)=>{
      if(!err && row.c==0){
        const stmt = db.prepare(`INSERT INTO leave_types(name, default_days, editable) VALUES(?,?,?)`);
        stmt.run('Annual',21,1);
        stmt.run('Sick',7,1);
        stmt.finalize();
      }
    });

    // seed admin/hod/employee users
    db.get(`SELECT COUNT(*) as c FROM users`, (err,row)=>{
      if(!err && row.c==0){
        const pwd = bcrypt.hashSync('password',10);
        const stmt = db.prepare(`INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`);
        stmt.run('Alice Admin','admin@example.com',pwd,'admin',null);
        stmt.run('Bob HOD','hod@example.com',pwd,'HOD','Engineering');
        stmt.run('Dana HOD','hod2@example.com',pwd,'HOD','HR');
        stmt.run('Charlie Employee','emp@example.com',pwd,'employee','Engineering');
        stmt.finalize(() => {
          // seed balances for each user and leave type
          db.all(`SELECT id FROM users`, (e,users)=>{
            db.all(`SELECT id,default_days FROM leave_types`, (ee,types)=>{
              const ins = db.prepare(`INSERT OR REPLACE INTO user_leave_balances(user_id,leave_type_id,remaining_days) VALUES(?,?,?)`);
              users.forEach(u=>{
                types.forEach(t=> ins.run(u.id,t.id,t.default_days));
              });
              ins.finalize();
              // create departments and assign HODs from seeded users
              db.get(`SELECT id FROM users WHERE email = ?`, ['hod@example.com'], (err1, bob)=>{
                db.get(`SELECT id FROM users WHERE email = ?`, ['hod2@example.com'], (err2, dana)=>{
                  if(bob && bob.id){
                    db.run(`INSERT OR REPLACE INTO departments(name, hod_user_id) VALUES(?,?)`, ['Engineering', bob.id]);
                  }
                  if(dana && dana.id){
                    db.run(`INSERT OR REPLACE INTO departments(name, hod_user_id) VALUES(?,?)`, ['HR', dana.id]);
                  }
                });
              });
            });
          });
        });

        // idempotent bulk-add requested departments and users
        const bulkDepartments = {
          'ICT': ['Stevaniah Kavela','Mercy Mukhwana','Eric Mokaya'],
          'Branch': ['Caroline Ngugi','Lilian Kimani','Maureen Kerubo','Alice Muthoni','Michael Mureithi'],
          'Finance': ['Patrick Ndegwa','Margaret Njeri','Elizabeth Mungai'],
          'Customer Service': ['Juliana Jeptoo','Faith Bonareri','Patience Mutunga','Eva Mukami','Peter Kariuki']
        };

        function initBalancesForUser(userId){
          db.all(`SELECT id, default_days FROM leave_types`, [], (e,types)=>{
            if(e) return;
            const ins = db.prepare(`INSERT OR REPLACE INTO user_leave_balances(user_id,leave_type_id,remaining_days) VALUES(?,?,?)`);
            types.forEach(t=> ins.run(userId, t.id, t.default_days));
            ins.finalize();
          });
        }

        Object.keys(bulkDepartments).forEach(deptName=>{
          // ensure department row exists
          db.get(`SELECT id, hod_user_id FROM departments WHERE name = ?`, [deptName], (er,deptRow)=>{
            if(er) return;
            const ensureHodAndThen = (hodId)=>{
              if(!deptRow){
                db.run(`INSERT INTO departments(name, hod_user_id) VALUES(?,?)`, [deptName, hodId || null]);
              }else if(hodId && deptRow.hod_user_id !== hodId){
                db.run(`UPDATE departments SET hod_user_id = ? WHERE id = ?`, [hodId, deptRow.id]);
              }
            };

            // ensure a HOD user exists for this department (create placeholder if missing)
            const hodEmail = 'hod_'+deptName.replace(/\s+/g,'').toLowerCase() + '@example.com';
            db.get(`SELECT id FROM users WHERE email = ?`, [hodEmail], (e2,urow)=>{
              if(e2) return;
              if(urow && urow.id){
                ensureHodAndThen(urow.id);
                // now add employees
                bulkDepartments[deptName].forEach(name=>{
                  const email = name.toLowerCase().replace(/\s+/g,'.') + '@example.com';
                  db.get(`SELECT id FROM users WHERE email = ?`, [email], (ee,existing)=>{
                    if(ee) return;
                    if(existing && existing.id) return;
                    const pwd = bcrypt.hashSync('password',10);
                    db.run(`INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`, [name,email,pwd,'employee',deptName], function(errIns){
                      if(errIns) return;
                      initBalancesForUser(this.lastID);
                    });
                  });
                });
              }else{
                // create HOD placeholder
                const pwd2 = bcrypt.hashSync('password',10);
                db.run(`INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`, [deptName+' HOD', hodEmail, pwd2, 'HOD', deptName], function(err3){
                  if(err3) return;
                  const hodId = this.lastID;
                  ensureHodAndThen(hodId);
                  initBalancesForUser(hodId);
                  // create employees
                  bulkDepartments[deptName].forEach(name=>{
                    const email = name.toLowerCase().replace(/\s+/g,'.') + '@example.com';
                    db.get(`SELECT id FROM users WHERE email = ?`, [email], (ee,existing)=>{
                      if(ee) return;
                      if(existing && existing.id) return;
                      const pwd = bcrypt.hashSync('password',10);
                      db.run(`INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`, [name,email,pwd,'employee',deptName], function(errIns){
                        if(errIns) return;
                        initBalancesForUser(this.lastID);
                      });
                    });
                  });
                });
              }
            });
          });
        });
      }
    });
  });
}

function parseDate(d){ return new Date(d+'T00:00:00'); }

function countWorkingDays(start, end, holidays){
  let s = parseDate(start);
  let e = parseDate(end);
  if(e < s) return 0;
  let days = 0;
  for(let d = new Date(s); d <= e; d.setDate(d.getDate()+1)){
    const dow = d.getDay();
    const iso = d.toISOString().slice(0,10);
    if(dow===0||dow===6) continue; // weekend
    if(holidays.includes(iso)) continue;
    days++;
  }
  return days;
}

function requireAuth(req,res,next){
  if(req.session && req.session.userId) return next();
  res.status(401).json({error:'unauthenticated'});
}

function requireRole(role){
  return (req,res,next)=>{
    if(req.session && req.session.role===role) return next();
    res.status(403).json({error:'forbidden'});
  };
}

app.post('/api/login', (req,res)=>{
  const {email,password} = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err,user)=>{
    if(err || !user) return res.status(400).json({error:'invalid'});
    if(!bcrypt.compareSync(password, user.password_hash)) return res.status(400).json({error:'invalid'});
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.department = user.department;
    res.json({id:user.id,full_name:user.full_name,role:user.role,department:user.department});
  });
});

app.post('/api/logout', (req,res)=>{ req.session.destroy(()=>res.json({ok:true})); });

app.get('/api/me', requireAuth, (req,res)=>{
  db.get(`SELECT id,full_name,email,role,department FROM users WHERE id = ?`, [req.session.userId], (e,u)=>{
    res.json(u);
  });
});

app.post('/api/apply', requireAuth, (req,res)=>{
  const {leave_type_id,start_date,end_date,reason} = req.body;
  const days = countWorkingDays(start_date,end_date,HOLIDAYS);
  if(days<=0) return res.status(400).json({error:'invalid date range'});
  // check balance
  db.get(`SELECT remaining_days FROM user_leave_balances WHERE user_id=? AND leave_type_id=?`, [req.session.userId, leave_type_id], (err,row)=>{
    if(err || !row) return res.status(400).json({error:'no balance'});
    if(row.remaining_days < days) return res.status(400).json({error:'insufficient balance'});
    const now = new Date().toISOString();
    db.run(`INSERT INTO leave_requests(user_id,leave_type_id,start_date,end_date,days,reason,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,
      [req.session.userId,leave_type_id,start_date,end_date,days,reason,'pending',now,now], function(err){
        if(err) return res.status(500).json({error:'db'});
        res.json({ok:true,id:this.lastID});
      });
  });
});

app.get('/api/leave_requests', requireAuth, (req,res)=>{
  const role = req.session.role;
  if(role==='employee'){
    db.all(`SELECT lr.*, u.full_name, lt.name as leave_type FROM leave_requests lr JOIN users u ON u.id=lr.user_id JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.user_id=? ORDER BY lr.created_at DESC`, [req.session.userId], (e,rows)=> res.json(rows));
  }else if(role==='HOD'){
    // HOD sees pending requests from their department
    db.all(`SELECT lr.*, u.full_name, lt.name as leave_type FROM leave_requests lr JOIN users u ON u.id=lr.user_id JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.status='pending' AND u.department = ? ORDER BY lr.created_at DESC`, [req.session.department], (e,rows)=> res.json(rows));
  }else if(role==='admin'){
    // admin sees hod_approved requests for final approval
    db.all(`SELECT lr.*, u.full_name, lt.name as leave_type FROM leave_requests lr JOIN users u ON u.id=lr.user_id JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.status IN ('hod_approved','pending','hod_approved') ORDER BY lr.created_at DESC`, [], (e,rows)=> res.json(rows));
  }
});

app.post('/api/leave_requests/:id/hod_action', requireAuth, (req,res)=>{
  if(req.session.role!=='HOD') return res.status(403).json({error:'forbidden'});
  const id = req.params.id; const {action,comment} = req.body;
  db.get(`SELECT lr.*, u.department FROM leave_requests lr JOIN users u ON u.id=lr.user_id WHERE lr.id=?`, [id], (e,lr)=>{
    if(e || !lr) return res.status(404).json({error:'not found'});
    if(lr.department !== req.session.department) return res.status(403).json({error:'not your dept'});
    if(action==='approve'){
      db.run(`UPDATE leave_requests SET status='hod_approved', hod_comment=?, updated_at=? WHERE id=?`, [comment, new Date().toISOString(), id], function(err){
        if(err) return res.status(500).json({error:'db'});
        res.json({ok:true});
      });
    }else{
      db.run(`UPDATE leave_requests SET status='rejected', hod_comment=?, updated_at=? WHERE id=?`, [comment, new Date().toISOString(), id], function(err){
        if(err) return res.status(500).json({error:'db'});
        res.json({ok:true});
      });
    }
  });
});

app.post('/api/leave_requests/:id/admin_action', requireAuth, (req,res)=>{
  if(req.session.role!=='admin') return res.status(403).json({error:'forbidden'});
  const id = req.params.id; const {action,comment} = req.body;
  db.get(`SELECT * FROM leave_requests WHERE id=?`, [id], (e,lr)=>{
    if(e || !lr) return res.status(404).json({error:'not found'});
    if(action==='approve'){
      // deduct balance
      db.get(`SELECT remaining_days FROM user_leave_balances WHERE user_id=? AND leave_type_id=?`, [lr.user_id, lr.leave_type_id], (err,row)=>{
        if(err || !row) return res.status(400).json({error:'no balance'});
        if(row.remaining_days < lr.days) return res.status(400).json({error:'insufficient balance'});
        const newRem = row.remaining_days - lr.days;
        db.run(`UPDATE user_leave_balances SET remaining_days=? WHERE user_id=? AND leave_type_id=?`, [newRem, lr.user_id, lr.leave_type_id], function(er){
          if(er) return res.status(500).json({error:'db'});
          db.run(`UPDATE leave_requests SET status='admin_approved', admin_comment=?, updated_at=? WHERE id=?`, [comment, new Date().toISOString(), id], function(err2){
            if(err2) return res.status(500).json({error:'db'});
            res.json({ok:true});
          });
        });
      });
    }else{
      db.run(`UPDATE leave_requests SET status='rejected', admin_comment=?, updated_at=? WHERE id=?`, [comment, new Date().toISOString(), id], function(err){
        if(err) return res.status(500).json({error:'db'});
        res.json({ok:true});
      });
    }
  });
});

app.get('/api/balances', requireAuth, (req,res)=>{
  if(req.session.role==='admin'){
    db.all(`SELECT ulb.*, u.full_name, lt.name as leave_type FROM user_leave_balances ulb JOIN users u ON u.id=ulb.user_id JOIN leave_types lt ON lt.id=ulb.leave_type_id`, [], (e,rows)=> res.json(rows));
  }else{
    db.all(`SELECT ulb.*, lt.name as leave_type FROM user_leave_balances ulb JOIN leave_types lt ON lt.id=ulb.leave_type_id WHERE user_id=?`, [req.session.userId], (e,rows)=> res.json(rows));
  }
});

app.put('/api/balances/:userId/:leaveTypeId', requireAuth, (req,res)=>{
  if(req.session.role!=='admin') return res.status(403).json({error:'forbidden'});
  const {userId, leaveTypeId} = req.params; const {remaining_days} = req.body;
  db.run(`INSERT OR REPLACE INTO user_leave_balances(user_id,leave_type_id,remaining_days) VALUES(?,?,?)`, [userId, leaveTypeId, remaining_days], function(err){
    if(err) return res.status(500).json({error:'db'});
    res.json({ok:true});
  });
});

app.get('/api/leave_types', requireAuth, (req,res)=>{
  db.all(`SELECT * FROM leave_types`, [], (e,rows)=> res.json(rows));
});

// Departments endpoints (admin only)
app.get('/api/departments', requireAuth, (req,res)=>{
  if(req.session.role !== 'admin') return res.status(403).json({error:'forbidden'});
  db.all(`SELECT d.id, d.name, d.hod_user_id, u.full_name as hod_name, u.email as hod_email FROM departments d LEFT JOIN users u ON u.id=d.hod_user_id ORDER BY d.name`, [], (err,rows)=>{
    if(err) return res.status(500).json({error:'db'});
    res.json(rows || []);
  });
});

app.post('/api/departments', requireAuth, (req,res)=>{
  if(req.session.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const {name, hod_user_id} = req.body;
  if(!name) return res.status(400).json({error:'missing name'});
  if(hod_user_id){
    db.get(`SELECT id FROM users WHERE id = ?`, [hod_user_id], (err,u)=>{
      if(err || !u) return res.status(400).json({error:'invalid hod_user_id'});
      db.run(`INSERT INTO departments(name, hod_user_id) VALUES(?,?)`, [name, hod_user_id], function(e2){ if(e2) return res.status(500).json({error:'db'}); res.json({ok:true,id:this.lastID}); });
    });
  }else{
    db.run(`INSERT INTO departments(name, hod_user_id) VALUES(?,?)`, [name, null], function(e2){ if(e2) return res.status(500).json({error:'db'}); res.json({ok:true,id:this.lastID}); });
  }
});

app.put('/api/departments/:id', requireAuth, (req,res)=>{
  if(req.session.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const id = req.params.id; const {name, hod_user_id} = req.body;
  if(hod_user_id){
    db.get(`SELECT id FROM users WHERE id = ?`, [hod_user_id], (err,u)=>{
      if(err || !u) return res.status(400).json({error:'invalid hod_user_id'});
      db.run(`UPDATE departments SET name = ?, hod_user_id = ? WHERE id = ?`, [name, hod_user_id, id], function(e2){ if(e2) return res.status(500).json({error:'db'}); res.json({ok:true}); });
    });
  }else{
    db.run(`UPDATE departments SET name = ?, hod_user_id = NULL WHERE id = ?`, [name, id], function(e2){ if(e2) return res.status(500).json({error:'db'}); res.json({ok:true}); });
  }
});

app.delete('/api/departments/:id', requireAuth, (req,res)=>{
  if(req.session.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const id = req.params.id;
  // ensure no users assigned to this department
  db.get(`SELECT name FROM departments WHERE id = ?`, [id], (err,row)=>{
    if(err || !row) return res.status(404).json({error:'not found'});
    const deptName = row.name;
    db.get(`SELECT COUNT(*) as c FROM users WHERE department = ?`, [deptName], (e,crow)=>{
      if(e) return res.status(500).json({error:'db'});
      if(crow && crow.c > 0) return res.status(400).json({error:'department has users; reassign or remove them first'});
      db.run(`DELETE FROM departments WHERE id = ?`, [id], function(er){ if(er) return res.status(500).json({error:'db'}); res.json({ok:true}); });
    });
  });
});

// Admin: create user (admin-only)
app.post('/api/users', requireAuth, (req,res)=>{
  if(req.session.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const {full_name, email, password, role, department} = req.body;
  if(!full_name || !email || !password || !role) return res.status(400).json({error:'missing fields'});
  const pwdHash = bcrypt.hashSync(password, 10);

  // helpers
  const initBalances = (userId, cb)=>{
    db.all(`SELECT id, default_days FROM leave_types`, [], (e,types)=>{
      if(e) return cb(e);
      const ins = db.prepare(`INSERT OR REPLACE INTO user_leave_balances(user_id,leave_type_id,remaining_days) VALUES(?,?,?)`);
      types.forEach(t=> ins.run(userId, t.id, t.default_days));
      ins.finalize(()=> cb(null));
    });
  };

  if(role === 'admin'){
    db.run(`INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`, [full_name,email,pwdHash,role,null], function(err){
      if(err){ if(err.code === 'SQLITE_CONSTRAINT') return res.status(400).json({error:'email exists'}); return res.status(500).json({error:'db'}); }
      const newUserId = this.lastID;
      initBalances(newUserId, ()=> res.json({ok:true,id:newUserId}));
    });
    return;
  }

  if(role === 'HOD'){
    if(!department) return res.status(400).json({error:'HOD must have a department'});
    // check department doesn't already have HOD
    db.get(`SELECT hod_user_id FROM departments WHERE name = ?`, [department], (err,deptRow)=>{
      if(err) return res.status(500).json({error:'db'});
      if(deptRow && deptRow.hod_user_id) return res.status(400).json({error:'department already has HOD'});
      // insert user
      db.run(`INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`, [full_name,email,pwdHash,role,department], function(err2){
        if(err2){ if(err2.code === 'SQLITE_CONSTRAINT') return res.status(400).json({error:'email exists'}); return res.status(500).json({error:'db'}); }
        const newUserId = this.lastID;
        // create or update department to assign this HOD
        db.run(`INSERT OR REPLACE INTO departments(name, hod_user_id) VALUES(?,?)`, [department, newUserId], (er)=>{
          if(er) return res.status(500).json({error:'db'});
          initBalances(newUserId, ()=> res.json({ok:true,id:newUserId}));
        });
      });
    });

    // Explicit seeding for provided list with HOD markers
    const explicitDepartments = {
      'ICT': [
        {name: 'Stevaniah Kavela'},
        {name: 'Mercy Mukhwana'},
        {name: 'Eric Mokaya', hod: true}
      ],
      'Branch': [
        {name: 'Caroline Ngugi'},
        {name: 'Lilian Kimani'},
        {name: 'Maureen Kerubo'},
        {name: 'Alice Muthoni'},
        {name: 'Michael Mureithi', hod: true}
      ],
      'Finance': [
        {name: 'Patrick Ndegwa'},
        {name: 'Margaret Njeri'},
        {name: 'Elizabeth Mungai', hod: true}
      ],
      'Customer Service': [
        {name: 'Juliana Jeptoo'},
        {name: 'Faith Bonareri'},
        {name: 'Patience Mutunga', hod: true},
        {name: 'Eva Mukami'},
        {name: 'Peter Kariuki'}
      ]
    };

    function ensureUser(name, role, dept, cb){
      const email = name.toLowerCase().replace(/\s+/g,'.') + '@example.com';
      db.get(`SELECT id, role FROM users WHERE email = ?`, [email], (e,row)=>{
        if(e) return cb(e);
        if(row && row.id){
          // if role needs update (e.g., promoted to HOD), update
          if(row.role !== role){
            db.run(`UPDATE users SET role = ?, department = ? WHERE id = ?`, [role, dept, row.id], (er)=>{ initBalancesForUser(row.id); cb(null, row.id); });
          }else{
            // ensure department set
            db.run(`UPDATE users SET department = ? WHERE id = ?`, [dept, row.id], ()=>{ initBalancesForUser(row.id); cb(null, row.id); });
          }
        }else{
          const pwd = bcrypt.hashSync('password',10);
          db.run(`INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`, [name,email,pwd,role,dept], function(errIns){ if(errIns) return cb(errIns); initBalancesForUser(this.lastID); cb(null, this.lastID); });
        }
      });
    }

    Object.keys(explicitDepartments).forEach(deptName=>{
      const people = explicitDepartments[deptName];
      // ensure department exists
      db.get(`SELECT id FROM departments WHERE name = ?`, [deptName], (er,dr)=>{
        if(er) return;
        if(!dr) db.run(`INSERT INTO departments(name, hod_user_id) VALUES(?,?)`, [deptName, null]);
        // create users and collect HOD
        people.forEach(p=>{
          const role = p.hod ? 'HOD' : 'employee';
          ensureUser(p.name, role, deptName, (err, uid)=>{
            if(err) return;
            if(p.hod && uid){
              // assign department hod_user_id
              db.run(`UPDATE departments SET hod_user_id = ? WHERE name = ?`, [uid, deptName]);
            }
          });
        });
      });
    });
    return;
  }

  // role === 'employee' or others: must belong to an existing department that has a HOD
  if(!department) return res.status(400).json({error:'employee must have a department'});
  db.get(`SELECT hod_user_id FROM departments WHERE name = ?`, [department], (err,row)=>{
    if(err) return res.status(500).json({error:'db'});
    if(!row || !row.hod_user_id) return res.status(400).json({error:'department must exist and have a HOD'});
    db.run(`INSERT INTO users(full_name,email,password_hash,role,department) VALUES(?,?,?,?,?)`, [full_name,email,pwdHash,role,department], function(err3){
      if(err3){ if(err3.code === 'SQLITE_CONSTRAINT') return res.status(400).json({error:'email exists'}); return res.status(500).json({error:'db'}); }
      const newUserId = this.lastID;
      initBalances(newUserId, ()=> res.json({ok:true,id:newUserId}));
    });
  });
});

// Admin: list users
app.get('/api/users', requireAuth, (req,res)=>{
  if(req.session.role !== 'admin') return res.status(403).json({error:'forbidden'});
  db.all(`SELECT id, full_name, email, role, department FROM users ORDER BY full_name`, [], (err, rows) => {
    if(err) return res.status(500).json({error:'db'});
    res.json(rows || []);
  });
});

// Admin: update user (name, role, department)
app.put('/api/users/:id', requireAuth, (req,res)=>{
  if(req.session.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const id = req.params.id; const {full_name, role, department} = req.body;
  // ensure HOD consistency: if this user is currently HOD for a department, prevent changing role/department without reassigning
  db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, current)=>{
    if(err || !current) return res.status(404).json({error:'not found'});
    db.get(`SELECT name FROM departments WHERE hod_user_id = ?`, [id], (e,dept)=>{
      if(e) return res.status(500).json({error:'db'});
      if(dept && (role !== 'HOD' || department !== dept.name)){
        return res.status(400).json({error:'user is HOD for department "'+dept.name+'"; reassign HOD before changing role/department'});
      }
      // if trying to make someone a HOD, ensure target department doesn't already have a different HOD
      if(role === 'HOD'){
        if(!department) return res.status(400).json({error:'HOD must have a department'});
        db.get(`SELECT hod_user_id FROM departments WHERE name = ?`, [department], (er,row)=>{
          if(er) return res.status(500).json({error:'db'});
          if(row && row.hod_user_id && row.hod_user_id != id) return res.status(400).json({error:'department already has HOD'});
          // proceed to update user
          db.run(`UPDATE users SET full_name = ?, role = ?, department = ? WHERE id = ?`, [full_name, role, department, id], function(err2){
            if(err2) return res.status(500).json({error:'db'});
            // ensure department row points to this user
            db.run(`INSERT OR REPLACE INTO departments(name, hod_user_id) VALUES(?,?)`, [department, id], (er2)=>{
              if(er2) return res.status(500).json({error:'db'});
              res.json({ok:true});
            });
          });
        });
      }else{
        // non-HOD update: simply update
        db.run(`UPDATE users SET full_name = ?, role = ?, department = ? WHERE id = ?`, [full_name, role, department, id], function(err3){
          if(err3) return res.status(500).json({error:'db'});
          res.json({ok:true});
        });
      }
    });
  });
});

// Admin: reset user password
app.post('/api/users/:id/reset_password', requireAuth, (req,res)=>{
  if(req.session.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const id = req.params.id; const {password} = req.body;
  if(!password || password.length < 4) return res.status(400).json({error:'password too short'});
  const hash = bcrypt.hashSync(password, 10);
  db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, id], function(err){
    if(err) return res.status(500).json({error:'db'});
    res.json({ok:true});
  });
});

// Admin: delete user and related data
app.delete('/api/users/:id', requireAuth, (req,res)=>{
  if(req.session.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const id = req.params.id;
  // prevent deleting a user who is assigned as HOD of any department
  db.get(`SELECT name FROM departments WHERE hod_user_id = ?`, [id], (err,dept)=>{
    if(err) return res.status(500).json({error:'db'});
    if(dept) return res.status(400).json({error:'cannot delete user; they are HOD for department '+dept.name+' - reassign HOD first'});
    db.serialize(()=>{
      db.run(`DELETE FROM leave_requests WHERE user_id = ?`, [id]);
      db.run(`DELETE FROM user_leave_balances WHERE user_id = ?`, [id]);
      db.run(`DELETE FROM users WHERE id = ?`, [id], function(err2){
        if(err2) return res.status(500).json({error:'db'});
        res.json({ok:true});
      });
    });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=>{
  initDb();
  console.log(`Server started on http://localhost:${PORT}`);
});
