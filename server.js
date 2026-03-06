const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { query, initPool } = require('./db');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'leave-secret', resave: false, saveUninitialized: false }));

// database helper is initialized later with initPool()


const HOLIDAYS = [
  '2026-01-01',
  '2026-12-25'
];

function parseDate(d) {
  return new Date(d + 'T00:00:00');
}

function countWorkingDays(start, end, holidays) {
  let s = parseDate(start);
  let e = parseDate(end);
  if (e < s) return 0;
  let days = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (dow === 0 || dow === 6) continue;
    if (holidays.includes(iso)) continue;
    days++;
  }
  return days;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'unauthenticated' });
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session && req.session.role === role) return next();
    res.status(403).json({ error: 'forbidden' });
  };
}

async function logAudit(userId, userEmail, action, entityType, entityId, details = null) {
  try {
    await query(
      `INSERT INTO audit_logs(user_id, user_email, action, entity_type, entity_id, details, timestamp)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [userId, userEmail, action, entityType, entityId, details, new Date()]
    );
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

async function initDb() {
  try {
    // create tables if they don't exist (T-SQL syntax)
    await query(`
      IF OBJECT_ID('users','U') IS NULL
      CREATE TABLE users(
        id INT IDENTITY PRIMARY KEY,
        full_name NVARCHAR(200),
        email NVARCHAR(200) UNIQUE,
        password_hash NVARCHAR(255),
        role NVARCHAR(50),
        department NVARCHAR(50)
      )
    `);

    await query(`
      IF OBJECT_ID('department','U') IS NULL
      CREATE TABLE department(
        id INT IDENTITY PRIMARY KEY,
        name NVARCHAR(100) UNIQUE,
        hod_user_id INT NULL,
        acting_hod_id INT NULL
      )
    `);

    await query(`
      IF OBJECT_ID('leave_type','U') IS NULL
      CREATE TABLE leave_type(
        id INT IDENTITY PRIMARY KEY,
        name NVARCHAR(100) UNIQUE,
        default_days INT,
        editable BIT DEFAULT 1
      )
    `);

    await query(`
      IF OBJECT_ID('balance','U') IS NULL
      CREATE TABLE balance(
        user_id INT,
        leave_type_id INT,
        remaining_days INT,
        PRIMARY KEY(user_id, leave_type_id)
      )
    `);

    await query(`
      IF OBJECT_ID('leave_requests','U') IS NULL
      CREATE TABLE leave_requests(
        id INT IDENTITY PRIMARY KEY,
        user_id INT,
        leave_type_id INT,
        start_date NVARCHAR(20),
        end_date NVARCHAR(20),
        days INT,
        reason NVARCHAR(1000),
        status NVARCHAR(50),
        hod_comment NVARCHAR(1000),
        admin_comment NVARCHAR(1000),
        created_at DATETIME2,
        updated_at DATETIME2
      )
    `);

    await query(`
      IF OBJECT_ID('audit_logs','U') IS NULL
      CREATE TABLE audit_logs(
        id BIGINT IDENTITY PRIMARY KEY,
        user_id INT NULL,
        user_email NVARCHAR(200) NULL,
        action NVARCHAR(100),
        entity_type NVARCHAR(100),
        entity_id INT NULL,
        details NVARCHAR(2000) NULL,
        timestamp DATETIME2 DEFAULT SYSUTCDATETIME()
      )
    `);

    // check for existing admin
    const adminCheck = await query("SELECT COUNT(*) AS cnt FROM users WHERE role='admin'");
    if (adminCheck.recordset[0].cnt > 0) {
      console.log('Database already initialized');
      return;
    }

    // seed leave types
    await query(
      `IF NOT EXISTS (SELECT 1 FROM leave_type WHERE name=@p0)
           INSERT INTO leave_type(name,default_days,editable) VALUES(@p0,@p1,@p2)`,
      ['Annual', 21, 1]
    );
    await query(
      `IF NOT EXISTS (SELECT 1 FROM leave_type WHERE name=@p0)
           INSERT INTO leave_type(name,default_days,editable) VALUES(@p0,@p1,@p2)`,
      ['Sick', 7, 1]
    );
    console.log('Seeded leave types');

    // seed admin user
    const pwd = bcrypt.hashSync('1234', 10);
    await query(
      `INSERT INTO users(full_name,email,password_hash,role,department) VALUES(@p0,@p1,@p2,@p3,@p4)`,
      ['System Admin', 'automation@maishabank.com', pwd, 'admin', null]
    );

    console.log('Database initialized and seeded');
  } catch (err) {
    console.error('initDb error:', err);
  }
}

// ===== HOLIDAYS =====

app.get('/api/holidays', (req, res) => {
  res.json(HOLIDAYS);
});

// ===== AUTHENTICATION =====

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    const user = result.recordset[0];
    if (!user) return res.status(400).json({ error: 'invalid' });
    const storedHash = user.password_hash || user.password || null;
    if (!storedHash || !bcrypt.compareSync(password, storedHash)) {
      return res.status(400).json({ error: 'invalid' });
    }

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.role = user.role;
    // support legacy schema where department may be stored as department_id
    req.session.department = user.department || (user.department_id ? String(user.department_id) : null);

    res.json({
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      department: req.session.department
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ===== PROFILE =====

app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, full_name, email, role, department FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (!result.recordset[0]) return res.status(404).json({ error: 'not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, full_name, email, role, department FROM users WHERE id = $1',
      [req.session.userId]
    );
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});



// ===== LEAVE REQUESTS =====

app.post('/api/leave_requests', requireAuth, async (req, res) => {
  const { leave_type_id, start_date, end_date, reason } = req.body;
  const days = countWorkingDays(start_date, end_date, HOLIDAYS);
  if (days <= 0) return res.status(400).json({ error: 'invalid date range' });

  try {
    const balanceResult = await query(
      'SELECT remaining_days FROM balance WHERE user_id = $1 AND leave_type_id = $2',
      [req.session.userId, leave_type_id]
    );
    const balance = balanceResult.recordset[0];
    if (!balance) return res.status(400).json({ error: 'no balance' });
    if (balance.remaining_days < days) {
      return res.status(400).json({ error: 'insufficient balance' });
    }

    const now = new Date();
    const insertResult = await query(
      `INSERT INTO leave_requests(user_id, leave_type_id, start_date, end_date, days, reason, status, created_at, updated_at)
       OUTPUT INSERTED.id AS id
       VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$7)`,
      [req.session.userId, leave_type_id, start_date, end_date, days, reason, now]
    );
    const requestId = insertResult.recordset[0].id;
    await logAudit(
      req.session.userId,
      req.session.userEmail,
      'CREATE',
      'leave_request',
      requestId,
      `Submitted leave request: ${days} days from ${start_date} to ${end_date}`
    );
    res.json({ ok: true, id: requestId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.post('/api/apply', requireAuth, async (req, res) => {
  const { leave_type_id, start_date, end_date, reason } = req.body;
  const days = countWorkingDays(start_date, end_date, HOLIDAYS);
  if (days <= 0) return res.status(400).json({ error: 'invalid date range' });

  try {
    const balanceResult = await query(
      'SELECT remaining_days FROM balance WHERE user_id = $1 AND leave_type_id = $2',
      [req.session.userId, leave_type_id]
    );
    const balance = balanceResult.recordset[0];
    if (!balance) return res.status(400).json({ error: 'no balance' });
    if (balance.remaining_days < days) {
      return res.status(400).json({ error: 'insufficient balance' });
    }

    const now = new Date();
    const insertResult = await query(
      `INSERT INTO leave_requests(user_id, leave_type_id, start_date, end_date, days, reason, status, created_at, updated_at)
       OUTPUT INSERTED.id AS id
       VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$7)`,
      [req.session.userId, leave_type_id, start_date, end_date, days, reason, now]
    );
    const requestId = insertResult.recordset[0].id;
    await logAudit(
      req.session.userId,
      req.session.userEmail,
      'CREATE',
      'leave_request',
      requestId,
      `Submitted leave request: ${days} days from ${start_date} to ${end_date}`
    );
    res.json({ ok: true, id: requestId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.get('/api/leave_requests', requireAuth, async (req, res) => {
  const role = req.session.role;
  try {
    let result;
    if (role === 'employee') {
      result = await query(
        `SELECT lr.*, u.full_name, lt.name as leave_type FROM leave_requests lr
         JOIN users u ON u.id=lr.user_id
         JOIN leave_type lt ON lt.id=lr.leave_type_id
         WHERE lr.user_id = $1 ORDER BY lr.created_at DESC`,
        [req.session.userId]
      );
    } else if (role === 'HOD') {
      result = await query(
        `SELECT lr.*, u.full_name, lt.name as leave_type FROM leave_requests lr
         JOIN users u ON u.id=lr.user_id
         JOIN leave_type lt ON lt.id=lr.leave_type_id
         WHERE u.department = $1 ORDER BY lr.created_at DESC`,
        [req.session.department]
      );
    } else if (role === 'admin') {
      result = await query(
        `SELECT lr.*, u.full_name, lt.name as leave_type, COALESCE(b.remaining_days, lt.default_days) as remaining_days
         FROM leave_requests lr
         JOIN users u ON u.id=lr.user_id
         JOIN leave_type lt ON lt.id=lr.leave_type_id
         LEFT JOIN balance b ON b.user_id=lr.user_id AND b.leave_type_id=lr.leave_type_id
         ORDER BY lr.created_at DESC`
      );
    }
    res.json((result && result.recordset) || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.post('/api/leave_requests/:id/hod_action', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { action, comment } = req.body;

  try {
    const result = await query(
      `SELECT lr.*, u.department FROM leave_requests lr
       JOIN users u ON u.id=lr.user_id WHERE lr.id = $1`,
      [id]
    );

    const lr = result.recordset[0];
    if (!lr) return res.status(404).json({ error: 'not found' });

    const deptRes = await query(
      `SELECT hod_user_id, acting_hod_id FROM department WHERE name = $1`,
      [lr.department]
    );
    const dept = (deptRes.recordset && deptRes.recordset[0]) || {};
    const allowedUserIds = [dept.hod_user_id, dept.acting_hod_id].filter(Boolean);
    if (!allowedUserIds.includes(req.session.userId)) {
      return res.status(403).json({ error: 'not authorized for this department' });
    }

    if (lr.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot approve/reject: request must be in "pending" status, currently: "${lr.status}"`
      });
    }

    const now = new Date();
    if (action === 'approve') {
      await query(
        `UPDATE leave_requests SET status='hod_approved', hod_comment=$1, updated_at=$2 WHERE id=$3`,
        [comment, now, id]
      );
      await logAudit(
        req.session.userId,
        req.session.userEmail,
        'APPROVE',
        'leave_request',
        id,
        `HOD approved leave request ${id}. Comment: ${comment}`
      );
      res.json({ ok: true });
    } else if (action === 'reject') {
      await query(
        `UPDATE leave_requests SET status='rejected', hod_comment=$1, updated_at=$2 WHERE id=$3`,
        [comment, now, id]
      );
      await logAudit(
        req.session.userId,
        req.session.userEmail,
        'REJECT',
        'leave_request',
        id,
        `HOD rejected leave request ${id}. Comment: ${comment}`
      );
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: 'invalid action' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.post('/api/leave_requests/:id/admin_action', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const id = parseInt(req.params.id);
  const { action, comment } = req.body;

  try {
    const result = await query(
      `SELECT * FROM leave_requests WHERE id = $1`,
      [id]
    );

    const lr = result.recordset[0];
    if (!lr) return res.status(404).json({ error: 'not found' });

    const now = new Date();
    if (action === 'approve') {
      if (lr.status !== 'hod_approved') {
        return res.status(400).json({
          error: `Cannot approve: request must be in "hod_approved" status, currently: "${lr.status}"`
        });
      }

      const balanceResult = await query(
        `SELECT remaining_days FROM balance WHERE user_id = $1 AND leave_type_id = $2`,
        [lr.user_id, lr.leave_type_id]
      );

      const balance = balanceResult.recordset[0];
      if (!balance) return res.status(400).json({ error: 'no balance' });
      if (balance.remaining_days < lr.days) {
        return res.status(400).json({ error: 'insufficient balance' });
      }

      const newRem = balance.remaining_days - lr.days;
      await query(
        `UPDATE balance SET remaining_days = $1 WHERE user_id = $2 AND leave_type_id = $3`,
        [newRem, lr.user_id, lr.leave_type_id]
      );

      await query(
        `UPDATE leave_requests SET status='admin_approved', admin_comment=$1, updated_at=$2 WHERE id=$3`,
        [comment, now, id]
      );
      await logAudit(
        req.session.userId,
        req.session.userEmail,
        'APPROVE',
        'leave_request',
        id,
        `Admin approved leave request ${id}. Comment: ${comment}`
      );
      res.json({ ok: true });
    } else if (action === 'reject') {
      await query(
        `UPDATE leave_requests SET status='rejected', admin_comment=$1, updated_at=$2 WHERE id=$3`,
        [comment, now, id]
      );
      await logAudit(
        req.session.userId,
        req.session.userEmail,
        'REJECT',
        'leave_request',
        id,
        `Admin rejected leave request ${id}. Comment: ${comment}`
      );
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: 'invalid action' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

// ===== BALANCES =====

app.get('/api/balances', requireAuth, async (req, res) => {
  try {
    let result;
    if (req.session.role === 'admin') {
      result = await query(
        `SELECT b.*, u.full_name, u.department, lt.name as leave_type FROM balance b
         JOIN users u ON u.id=b.user_id
         JOIN leave_type lt ON lt.id=b.leave_type_id`
      );
    } else {
      result = await query(
        `SELECT b.*, u.full_name, u.department, lt.name as leave_type FROM balance b
         JOIN users u ON u.id=b.user_id
         JOIN leave_type lt ON lt.id=b.leave_type_id
         WHERE user_id = $1`,
        [req.session.userId]
      );
    }
    res.json((result && result.recordset) || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.put('/api/balances/:userId/:leaveTypeId', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const userId = parseInt(req.params.userId);
  const leaveTypeId = parseInt(req.params.leaveTypeId);
  const { remaining_days } = req.body;

  try {
    await query(
      `MERGE balance AS target
         USING (VALUES(@p0,@p1,@p2)) AS src(user_id, leave_type_id, remaining_days)
         ON target.user_id = src.user_id AND target.leave_type_id = src.leave_type_id
         WHEN MATCHED THEN UPDATE SET remaining_days = src.remaining_days
         WHEN NOT MATCHED THEN INSERT(user_id, leave_type_id, remaining_days) VALUES(src.user_id, src.leave_type_id, src.remaining_days);`,
      [userId, leaveTypeId, remaining_days]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

// ===== LEAVE TYPES =====

app.get('/api/leave_types', requireAuth, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM leave_type`);
    res.json((result && result.recordset) || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

// ===== DEPARTMENTS =====

app.get('/api/departments', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.id, d.name, d.hod_user_id, u.full_name as hod_name, u.email as hod_email
       FROM department d
       LEFT JOIN users u ON u.id=d.hod_user_id
       ORDER BY d.name`
    );
    res.json((result && result.recordset) || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.post('/api/departments', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const { name, hod_user_id } = req.body;
  if (!name) return res.status(400).json({ error: 'missing name' });

  try {
    if (hod_user_id) {
      const userCheck = await query(
        `SELECT id FROM users WHERE id = $1`,
        [hod_user_id]
      );
      if (userCheck.recordset.length === 0) {
        return res.status(400).json({ error: 'invalid hod_user_id' });
      }
    }

    const insert = await query(
      `INSERT INTO department(name, hod_user_id)
       OUTPUT INSERTED.id AS id
       VALUES ($1, $2)`,
      [name, hod_user_id || null]
    );
    res.json({ ok: true, id: insert.recordset[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.put('/api/departments/:id', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const id = parseInt(req.params.id);
  const { name, hod_user_id } = req.body;

  try {
    if (hod_user_id) {
      const userCheck = await query(
        `SELECT id FROM users WHERE id = $1`,
        [hod_user_id]
      );
      if (userCheck.recordset.length === 0) {
        return res.status(400).json({ error: 'invalid hod_user_id' });
      }
    }

    await query(
      `UPDATE department SET name = $1, hod_user_id = $2 WHERE id = $3`,
      [name, hod_user_id || null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.delete('/api/departments/:id', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const id = parseInt(req.params.id);

  try {
    const deptResult = await query(
      `SELECT name FROM department WHERE id = $1`,
      [id]
    );

    if (!deptResult.recordset || deptResult.recordset.length === 0) {
      return res.status(404).json({ error: 'not found' });
    }

    const deptName = deptResult.recordset[0].name;
    const countResult = await query(
      `SELECT COUNT(*) as c FROM users WHERE department = $1`,
      [deptName]
    );

    if (countResult.recordset[0].c > 0) {
      return res.status(400).json({
        error: 'department has users; reassign or remove them first'
      });
    }

    await query(`DELETE FROM department WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.post('/api/departments/:id/acting_hod', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const id = parseInt(req.params.id);
  const { user_id } = req.body;
  try {
    await query(
      `UPDATE department SET acting_hod_id = $1 WHERE id = $2`,
      [user_id || null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

// ===== HOD FEATURES =====

app.get('/api/department/employees', requireAuth, async (req, res) => {
  try {
    if (req.session.role !== 'HOD') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const department = req.session.department;
    if (!department) return res.status(400).json({ error: 'department not set' });

    const empResult = await query(
      `SELECT id, full_name, email FROM users WHERE department = $1 AND role = 'employee' ORDER BY full_name`,
      [department]
    );

    const employees = (empResult && empResult.recordset) || [];

    const employeesWithBalances = await Promise.all(
      employees.map(async (emp) => {
        const balanceResult = await query(
          `SELECT lt.name, COALESCE(b.remaining_days, lt.default_days) as days
           FROM leave_type lt
           LEFT JOIN balance b ON b.user_id = $1 AND b.leave_type_id = lt.id`,
          [emp.id]
        );

        const leave_balances = {};
        ((balanceResult && balanceResult.recordset) || []).forEach(row => {
          leave_balances[row.name] = row.days;
        });

        return {
          id: emp.id,
          full_name: emp.full_name,
          email: emp.email,
          leave_balances
        };
      })
    );

    res.json(employeesWithBalances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.get('/api/department/leave-records', requireAuth, async (req, res) => {
  try {
    if (req.session.role !== 'HOD') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const department = req.session.department;
    if (!department) return res.status(400).json({ error: 'department not set' });

    const result = await query(
      `SELECT lr.id, lr.days, lr.start_date, lr.end_date, lr.reason, lr.status,
              u.full_name, u.email, lt.name as leave_type
       FROM leave_requests lr
       JOIN users u ON u.id = lr.user_id
       JOIN leave_type lt ON lt.id = lr.leave_type_id
       WHERE u.department = $1
       ORDER BY lr.created_at DESC`,
      [department]
    );

    res.json((result && result.recordset) || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

// ===== USERS =====

app.post('/api/users', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const { full_name, email, password, role, department } = req.body;
  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const pwdHash = bcrypt.hashSync(password, 10);

  try {
    const initBalances = async (userId) => {
      const types = await query(`SELECT id, default_days FROM leave_type`);
      for (const t of types.recordset) {
        await query(
          `MERGE balance AS target
             USING (VALUES(@p0,@p1,@p2)) AS src(user_id, leave_type_id, remaining_days)
             ON target.user_id = src.user_id AND target.leave_type_id = src.leave_type_id
             WHEN MATCHED THEN UPDATE SET remaining_days = src.remaining_days
             WHEN NOT MATCHED THEN INSERT(user_id, leave_type_id, remaining_days) VALUES(src.user_id, src.leave_type_id, src.remaining_days);`,
          [userId, t.id, t.default_days]
        );
      }
    };

    if (role === 'admin') {
      const result = await query(
        `INSERT INTO users(full_name, email, password_hash, role, department)
         OUTPUT INSERTED.id AS id
         VALUES ($1, $2, $3, $4, NULL)`,
        [full_name, email, pwdHash, role]
      );
      const newUserId = result.recordset[0].id;
      await initBalances(newUserId);
      await logAudit(
        req.session.userId,
        req.session.userEmail,
        'CREATE',
        'user',
        newUserId,
        `Created admin user: ${full_name} (${email})`
      );
      return res.json({ ok: true, id: newUserId });
    }

    if (role === 'HOD') {
      if (!department) return res.status(400).json({ error: 'HOD must have a department' });
      const deptCheck = await query(
        `SELECT hod_user_id FROM department WHERE name = $1`,
        [department]
      );
      if (deptCheck.recordset.length > 0 && deptCheck.recordset[0].hod_user_id) {
        return res.status(400).json({ error: 'department already has HOD' });
      }

      const result = await query(
        `INSERT INTO users(full_name, email, password_hash, role, department)
         OUTPUT INSERTED.id AS id
         VALUES ($1, $2, $3, $4, $5)`,
        [full_name, email, pwdHash, role, department]
      );
      const newUserId = result.recordset[0].id;
      await query(
        `MERGE department AS target
           USING (VALUES(@p0,@p1)) AS src(name, hod_user_id)
           ON target.name = src.name
           WHEN MATCHED THEN UPDATE SET hod_user_id = src.hod_user_id
           WHEN NOT MATCHED THEN INSERT(name, hod_user_id) VALUES(src.name, src.hod_user_id);`,
        [department, newUserId]
      );
      await initBalances(newUserId);
      await logAudit(
        req.session.userId,
        req.session.userEmail,
        'CREATE',
        'user',
        newUserId,
        `Created HOD: ${full_name} (${email}) for department ${department}`
      );
      return res.json({ ok: true, id: newUserId });
    }

    if (!department) return res.status(400).json({ error: 'employee must have a department' });
    const deptCheck = await query(
      `SELECT hod_user_id FROM department WHERE name = $1`,
      [department]
    );
    if (deptCheck.recordset.length === 0 || !deptCheck.recordset[0].hod_user_id) {
      return res.status(400).json({ error: 'department must exist and have a HOD' });
    }

    const result = await query(
      `INSERT INTO users(full_name, email, password_hash, role, department)
       OUTPUT INSERTED.id AS id
       VALUES ($1, $2, $3, $4, $5)`,
      [full_name, email, pwdHash, role, department]
    );
    const newUserId = result.recordset[0].id;
    await initBalances(newUserId);
    await logAudit(
      req.session.userId,
      req.session.userEmail,
      'CREATE',
      'user',
      newUserId,
      `Created employee: ${full_name} (${email}) in department ${department}`
    );
    res.json({ ok: true, id: newUserId });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: 'email exists' });
    res.status(500).json({ error: 'db' });
  }
});

app.get('/api/users', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await query(
      `SELECT id, full_name, email, role, department FROM users ORDER BY full_name`
    );
    res.json((result && result.recordset) || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const id = parseInt(req.params.id);
  const { full_name, role, department } = req.body;

  try {
    const currentResult = await query(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );
    if (!currentResult.recordset || currentResult.recordset.length === 0) {
      return res.status(404).json({ error: 'not found' });
    }

    const user = currentResult.recordset[0];
    const userEmail = user.email;
    const oldFullName = user.full_name;
    const oldRole = user.role;
    const oldDept = user.department;

    const deptResult = await query(
      `SELECT name FROM department WHERE hod_user_id = $1`,
      [id]
    );

    if (deptResult.recordset.length > 0 && (role !== 'HOD' || department !== deptResult.recordset[0].name)) {
      return res.status(400).json({
        error: `user is HOD for department "${deptResult.recordset[0].name}"; reassign HOD before changing role/department`
      });
    }

    if (role === 'HOD') {
      if (!department) return res.status(400).json({ error: 'HOD must have a department' });
      const deptCheck = await query(
        `SELECT hod_user_id FROM department WHERE name = $1`,
        [department]
      );
      if (deptCheck.recordset.length > 0 && deptCheck.recordset[0].hod_user_id && deptCheck.recordset[0].hod_user_id != id) {
        return res.status(400).json({ error: 'department already has HOD' });
      }

      await query(
        `UPDATE users SET full_name = $1, role = $2, department = $3 WHERE id = $4`,
        [full_name, role, department, id]
      );

      await query(
        `MERGE department AS target
           USING (VALUES(@p0,@p1)) AS src(name,hod_user_id)
           ON target.name = src.name
           WHEN MATCHED THEN UPDATE SET hod_user_id = src.hod_user_id
           WHEN NOT MATCHED THEN INSERT(name,hod_user_id) VALUES(src.name,src.hod_user_id);`,
        [department, id]
      );
    } else {
      await query(
        `UPDATE users SET full_name = $1, role = $2, department = $3 WHERE id = $4`,
        [full_name, role, department, id]
      );
    }

    const changes = [];
    if (full_name !== oldFullName) changes.push(`name ${oldFullName} -> ${full_name}`);
    if (role !== oldRole) changes.push(`role ${oldRole} -> ${role}`);
    if (department !== oldDept) changes.push(`department ${oldDept} -> ${department}`);

    await logAudit(
      req.session.userId,
      req.session.userEmail,
      'UPDATE',
      'user',
      id,
      `Updated user: ${changes.join(', ')}`
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.post('/api/users/:id/reset_password', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const id = parseInt(req.params.id);
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'password too short' });
  }

  try {
    const userResult = await query(
      `SELECT email FROM users WHERE id = $1`,
      [id]
    );

    if (!userResult.recordset || userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'not found' });
    }

    const userEmail = userResult.recordset[0].email;
    const hash = bcrypt.hashSync(password, 10);
    await query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hash, id]
    );

    await logAudit(
      req.session.userId,
      req.session.userEmail,
      'UPDATE',
      'user',
      id,
      `Reset password for user`
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const id = parseInt(req.params.id);

  try {
    const userResult = await query(
      `SELECT email, full_name FROM users WHERE id = $1`,
      [id]
    );

    if (!userResult.recordset || userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'not found' });
    }

    const userEmail = userResult.recordset[0].email;
    const fullName = userResult.recordset[0].full_name;

    const deptResult = await query(
      `SELECT name FROM department WHERE hod_user_id = $1`,
      [id]
    );

    if (deptResult.recordset.length > 0) {
      return res.status(400).json({
        error: `cannot delete user; they are HOD for department ${deptResult.recordset[0].name} - reassign HOD first`
      });
    }

    await query(`DELETE FROM leave_requests WHERE user_id = $1`, [id]);
    await query(`DELETE FROM balance WHERE user_id = $1`, [id]);
    await query(`DELETE FROM users WHERE id = $1`, [id]);

    await logAudit(
      req.session.userId,
      req.session.userEmail,
      'DELETE',
      'user',
      id,
      `Deleted user: ${fullName} (${userEmail})`
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

// ===== AUDIT LOGS =====

app.get('/api/audit-logs', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });

  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 50;
    const offset = page * limit;
    const { action, user_email: userEmail, start_date: startDate, end_date: endDate } = req.query;

    let clauses = [];
    let params = [];

    if (action) { clauses.push(`action = $${params.length + 1}`); params.push(action); }
    if (userEmail) { clauses.push(`user_email = $${params.length + 1}`); params.push(userEmail); }
    if (startDate) { clauses.push(`timestamp >= $${params.length + 1}`); params.push(new Date(startDate)); }
    if (endDate) { clauses.push(`timestamp <= $${params.length + 1}`); params.push(new Date(endDate)); }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    // SQL Server syntax for pagination
    const dataQuery = `SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC
                       OFFSET $${params.length + 1} ROWS FETCH NEXT $${params.length + 2} ROWS ONLY`;
    const countQuery = `SELECT COUNT(*) AS total FROM audit_logs ${where}`;

    const dataResult = await query(dataQuery, [...params, offset, limit]);
    const countResult = await query(countQuery, params);

    const total = parseInt(countResult.recordset[0].total, 10);

    res.json({
      data: dataResult.recordset,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'db' });
  }
});

// ===== ACTIVITIES =====

app.get('/api/employee/:userId/activities', requireAuth, async (req, res) => {
  const targetUserId = parseInt(req.params.userId, 10);
  try {
    // Permission check
    if (req.session.role !== 'admin' && req.session.userId !== targetUserId) {
      const u = await query('SELECT department FROM users WHERE id = $1', [targetUserId]);
      if (!u.recordset || u.recordset.length === 0) return res.status(404).json({ error: 'user not found' });
      const dept = u.recordset[0].department;
      const hod = await query(
        `SELECT id FROM users WHERE id = $1 AND role='HOD' AND department = $2`,
        [req.session.userId, dept]
      );
      if (!hod.recordset || hod.recordset.length === 0) return res.status(403).json({ error: 'forbidden' });
    }

    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 50;
    const offset = page * limit;

    const data = await query(
      `SELECT * FROM audit_logs WHERE user_id = $1 OR entity_id = $1 ORDER BY timestamp DESC
       OFFSET $2 ROWS FETCH NEXT $3 ROWS ONLY`,
      [targetUserId, offset, limit]
    );
    const count = await query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE user_id = $1 OR entity_id = $1`,
      [targetUserId]
    );

    const total = parseInt(count.recordset[0].total, 10);
    res.json({
      data: data.recordset,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Activities error:', err);
    res.status(500).json({ error: 'db' });
  }
});

// ===== ANALYTICS =====

app.get('/api/calc_days', (req, res) => {
  const { start_date, end_date } = req.body || req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'missing dates' });
  }
  const days = countWorkingDays(start_date, end_date, HOLIDAYS);
  res.json({ days });
});

app.get('/api/analytics/departments', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await query(
      `SELECT u.department, CAST(SUM(lr.days) AS INT) as days FROM leave_requests lr
       JOIN users u ON u.id=lr.user_id
       WHERE lr.status='admin_approved'
       GROUP BY u.department`
    );
    res.json((result && result.recordset) || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.get('/api/analytics/types', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await query(
      `SELECT lt.name as type, CAST(SUM(lr.days) AS INT) as days FROM leave_requests lr
       JOIN leave_type lt ON lt.id=lr.leave_type_id
       WHERE lr.status='admin_approved'
       GROUP BY lt.name`
    );
    res.json((result && result.recordset) || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

// ===== SERVER START =====

const PORT = process.env.PORT || 3003;
app.listen(PORT, async () => {
  await initPool();
  await initDb();
  console.log(`Server started on http://localhost:${PORT}`);
});
