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

<<<<<<< HEAD
// database helper is initialized later with initPool()

=======
// ===== HR USERS LISTING =====
app.get('/api/hr/users', requireAuth, async (req, res) => {
  // Allow only HR role (Elizabeth or any user with role 'HR')
  if (req.session.role !== 'HR' && req.session.userEmail !== 'elizabeth.mungai@maishabank.com') {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    // Get all users
    const usersResult = await query(
      `SELECT id, full_name, email, role, department FROM users ORDER BY full_name`
    );
    const users = usersResult.recordset;

    // Get all balances
    const balancesResult = await query(
      `SELECT b.user_id, lt.name as leave_type, b.remaining_days, b.accrued_days
       FROM balance b
       JOIN leave_type lt ON lt.id = b.leave_type_id`
    );
    const balances = balancesResult.recordset;

    // Map balances to users (same as admin panel)
    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = { ...u, annual: 0, sick: 0, maternity: 0, paternity: 0, accrued_days: 0 };
    });
    balances.forEach(b => {
      const u = userMap[b.user_id];
      if (u) {
        const type = b.leave_type.toLowerCase();
        if (type === 'annual') {
          u.annual = b.remaining_days;
          u.accrued_days = b.accrued_days ?? 0;
        }
        else if (type === 'sick') u.sick = b.remaining_days;
        else if (type === 'maternity') u.maternity = b.remaining_days;
        else if (type === 'paternity') u.paternity = b.remaining_days;
      }
    });
    res.json(Object.values(userMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

// Test endpoint for Outlook SMTP
app.get('/api/test_outlook_email', async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: 'automation@maishabank.com',
        pass: 'test.test800'
      }
    });
    const mailOptions = {
      from: 'automation@maishabank.com',
      to: req.query.to || 'automation@maishabank.com',
      subject: 'Test Email from Leave System',
      text: 'This is a test email from the Leave System.'
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('SMTP TEST ERROR:', error);
        return res.status(500).json({ error: error.toString() });
      } else {
        console.log('SMTP TEST SENT:', info.response);
        return res.json({ ok: true, info: info.response });
      }
    });
  } catch (err) {
    console.error('SMTP TEST FATAL:', err);
    res.status(500).json({ error: err.toString() });
  }
});

// database helper is initialized later with initPool()

const crypto = require('crypto');
const passwordResetTokens = {};

app.get('/api/password_change/:token', async (req, res) => {
  const { token } = req.params;
  const entry = passwordResetTokens[token];
  if (!entry || Date.now() > entry.expiry) {
    return res.status(400).send('Invalid or expired link');
  }
  // Render a simple HTML form for password change
  res.send(`
    <html><body style="font-family:sans-serif;background:#f9fafb;padding:40px;">
      <h2>Change Your Password</h2>
      <form method="POST" action="/api/password_change/${token}">
        <input type="password" name="password" placeholder="New password" required minlength="4" style="padding:8px;margin-bottom:12px;width:220px;"/><br>
        <button type="submit" style="padding:8px 16px;background:#10b981;color:#fff;border:none;border-radius:4px;">Change Password</button>
      </form>
    </body></html>
  `);
});

app.post('/api/password_change/:token', async (req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    const { token } = req.params;
    const entry = passwordResetTokens[token];
    if (!entry || Date.now() > entry.expiry) {
      return res.status(400).send('Invalid or expired link');
    }
    const params = new URLSearchParams(body);
    const password = params.get('password');
    if (!password || password.length < 4) {
      return res.status(400).send('Password too short');
    }
    const hash = bcrypt.hashSync(password, 10);
    await query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hash, entry.userId]
    );
    delete passwordResetTokens[token];
    res.send('<b>Password changed successfully. You can now log in.</b>');
  });
});
>>>>>>> d03d514 (Initial push: leave management system)

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
<<<<<<< HEAD

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
=======

    // Special redirect for Elizabeth Mungai (HR)
    if (user.email === 'elizabeth.mungai@maishabank.com') {
      res.json({
        id: user.id,
        full_name: user.full_name,
        role: 'HR',
        department: req.session.department,
        redirect: '/hr.html'
      });
    } else {
      res.json({
        id: user.id,
        full_name: user.full_name,
        role: user.role,
        department: req.session.department,
        redirect: `/${user.role === 'admin' ? 'admin' : user.role === 'HOD' ? 'hod' : 'employee'}.html`
      });
    }
>>>>>>> d03d514 (Initial push: leave management system)
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

<<<<<<< HEAD
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

=======
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
    // Notify HR of new leave request
    try {
      const userRes = await query('SELECT full_name, email FROM users WHERE id = $1', [req.session.userId]);
      const user = userRes.recordset[0];
      // Get all HR emails
      const hrRes = await query("SELECT email FROM users WHERE role = 'HR'");
      const hrEmails = hrRes.recordset.map(r => r.email);
      if (hrEmails.length > 0) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: 'smtp.office365.com',
            port: 587,
            secure: false,
            auth: { user: 'automation@maishabank.com', pass: 'test.test800' }
        });
        const mailOptions = {
          from: 'automation@maishabank.com',
          to: hrEmails.join(','),
          subject: 'New Leave Request Submitted',
          text: `${user.full_name} (${user.email}) has submitted a leave request for ${days} days (${start_date} to ${end_date}). Reason: ${reason}`
        };
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) console.error('Leave request email error:', error);
          else console.log('Leave request email sent:', info.response);
        });
      }
    } catch (e) { console.error('Notify HR error:', e); }
    // ===== HR APPROVAL ENDPOINT =====
    app.post('/api/leave_requests/:id/hr_action', requireAuth, async (req, res) => {
      if (req.session.role !== 'HR') return res.status(403).json({ error: 'forbidden' });
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
          if (lr.status !== 'pending') {
            return res.status(400).json({ error: `Cannot approve: request must be in 'pending' status, currently: '${lr.status}'` });
          }
          await query(
            `UPDATE leave_requests SET status='hr_approved', hod_comment=$1, updated_at=$2 WHERE id=$3`,
            [comment, now, id]
          );
          await logAudit(
            req.session.userId,
            req.session.userEmail,
            'HR_APPROVE',
            'leave_request',
            id,
            `HR approved leave request ${id}. Comment: ${comment}`
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
            'HR_REJECT',
            'leave_request',
            id,
            `HR rejected leave request ${id}. Comment: ${comment}`
          );
          // Notify employee
          try {
            const userRes = await query('SELECT full_name, email FROM users WHERE id = $1', [lr.user_id]);
            const user = userRes.recordset[0];
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
              host: 'smtp.office365.com',
              port: 587,
              secure: false,
              auth: { user: 'automation@maishabank.com', pass: 'test.test800' }
            });
            transporter.sendMail({
              from: 'automation@maishabank.com',
              to: user.email,
              subject: 'Your Leave Request was Rejected by HR',
              text: `Your leave request (ID: ${id}) was rejected by HR. Reason: ${comment}`
            }, (error, info) => {
              if (error) console.error('HR rejection email to employee error:', error);
              else console.log('HR rejection email to employee sent:', info.response);
            });
          } catch (e) { console.error('Notify employee on HR rejection error:', e); }
          res.json({ ok: true });
        } else {
          res.status(400).json({ error: 'invalid action' });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'db' });
      }
    });
    res.json({ ok: true, id: requestId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.post('/api/apply', requireAuth, async (req, res) => {
  const { leave_type_id, start_date, end_date, reason } = req.body;
  const days = countWorkingDays(start_date, end_date, HOLIDAYS);
  console.log('[LEAVE APPLY] User:', req.session.userId, 'Type:', leave_type_id, 'Start:', start_date, 'End:', end_date, 'Days:', days, 'Reason:', reason);
  if (days <= 0) {
    console.log('[LEAVE APPLY] Invalid date range');
    return res.status(400).json({ error: 'invalid date range' });
  }

  try {
    const balanceResult = await query(
      'SELECT remaining_days FROM balance WHERE user_id = $1 AND leave_type_id = $2',
      [req.session.userId, leave_type_id]
    );
    const balance = balanceResult.recordset[0];
    if (!balance) {
      console.log('[LEAVE APPLY] No balance for user', req.session.userId, 'type', leave_type_id);
      return res.status(400).json({ error: 'no balance' });
    }
    if (balance.remaining_days < days) {
      console.log('[LEAVE APPLY] Insufficient balance for user', req.session.userId, 'type', leave_type_id, 'needed', days, 'remaining', balance.remaining_days);
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
    console.log('[LEAVE APPLY] Inserted leave request ID:', requestId);
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
    console.error('[LEAVE APPLY ERROR]', err);
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
    } else if (role === 'HR') {
      // HR sees all requests needing first approval (status 'pending')
      result = await query(
        `SELECT lr.*, u.full_name, lt.name as leave_type FROM leave_requests lr
         JOIN users u ON u.id=lr.user_id
         JOIN leave_type lt ON lt.id=lr.leave_type_id
         WHERE lr.status = 'pending'
         ORDER BY lr.created_at DESC`
      );
    } else if (role === 'admin') {
      // Admin sees leave requests only after HR approval
      result = await query(
        `SELECT lr.*, u.full_name, lt.name as leave_type, COALESCE(b.remaining_days, lt.default_days) as remaining_days
         FROM leave_requests lr
         JOIN users u ON u.id=lr.user_id
         JOIN leave_type lt ON lt.id=lr.leave_type_id
         LEFT JOIN balance b ON b.user_id=lr.user_id AND b.leave_type_id=lr.leave_type_id
         WHERE lr.status = 'hr_approved'
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
      `SELECT hod_email, acting_hod_email FROM department WHERE name = $1`,
      [lr.department]
    );
    const dept = (deptRes.recordset && deptRes.recordset[0]) || {};
    const allowedEmails = [dept.hod_email, dept.acting_hod_email].filter(Boolean);
    if (!allowedEmails.includes(req.session.userEmail)) {
      return res.status(403).json({ error: 'not authorized for this department (email check)' });
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
      // Notify employee and admin
      try {
        const userRes = await query('SELECT full_name, email FROM users WHERE id = $1', [lr.user_id]);
        const user = userRes.recordset[0];
        const adminRes = await query("SELECT email FROM users WHERE role = 'admin'");
        const adminEmails = adminRes.recordset.map(a => a.email);
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: 'smtp.office365.com',
          port: 587,
          secure: false,
          auth: { user: 'automation@maishabank.com', pass: 'test.test700' }
        });
        // Notify employee
        transporter.sendMail({
          from: 'automation@maishabank.com',
          to: user.email,
          subject: 'Your Leave Request was Approved by HOD',
          text: `Your leave request (ID: ${id}) was approved by HOD. Comment: ${comment}`
        }, (error, info) => {
          if (error) console.error('HOD approval email to employee error:', error);
          else console.log('HOD approval email to employee sent:', info.response);
        });
        // Notify admin
        if (adminEmails.length > 0) {
          transporter.sendMail({
            from: 'automation@maishabank.com',
            to: adminEmails.join(','),
            subject: 'Leave Request Awaiting Admin Approval',
            text: `Leave request (ID: ${id}) for ${user.full_name} has been approved by HOD and awaits your review.`
          }, (error, info) => {
            if (error) console.error('HOD approval email to admin error:', error);
            else console.log('HOD approval email to admin sent:', info.response);
          });
        }
      } catch (e) { console.error('Notify on HOD approval error:', e); }
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
      // Notify employee with HOD info
      try {
        const userRes = await query('SELECT full_name, email FROM users WHERE id = $1', [lr.user_id]);
        const user = userRes.recordset[0];
        const hodName = req.session.userEmail;
        const hodFullName = req.session.userEmail;
        // Try to get HOD full name from users table
        let hodDisplay = req.session.userEmail;
        try {
          const hodRes = await query('SELECT full_name FROM users WHERE email = $1', [req.session.userEmail]);
          if (hodRes.recordset[0] && hodRes.recordset[0].full_name) {
            hodDisplay = hodRes.recordset[0].full_name + ' (' + req.session.userEmail + ')';
          }
        } catch {}
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: 'smtp.office365.com',
          port: 587,
          secure: false,
          auth: { user: 'automation@maishabank.com', pass: 'test.test700' }
        });
        transporter.sendMail({
          from: 'automation@maishabank.com',
          to: user.email,
          subject: 'Your Leave Request was Rejected by HOD',
          text: `Your leave request (ID: ${id}) was rejected by HOD: ${hodDisplay}\nReason: ${comment}`
        }, (error, info) => {
          if (error) console.error('HOD rejection email to employee error:', error);
          else console.log('HOD rejection email to employee sent:', info.response);
        });
      } catch (e) { console.error('Notify on HOD rejection error:', e); }
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: 'invalid action' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

>>>>>>> d03d514 (Initial push: leave management system)
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
<<<<<<< HEAD
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
=======
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
      // Notify employee
      try {
        const userRes = await query('SELECT full_name, email FROM users WHERE id = $1', [lr.user_id]);
        const user = userRes.recordset[0];
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: 'smtp.office365.com',
          port: 587,
          secure: false,
          auth: { user: 'automation@maishabank.com', pass: 'test.test700' }
        });
        transporter.sendMail({
          from: 'automation@maishabank.com',
          to: user.email,
          subject: 'Your Leave Request was Approved by Admin',
          text: `Your leave request (ID: ${id}) was approved by Admin. Comment: ${comment}`
        }, (error, info) => {
          if (error) console.error('Admin approval email to employee error:', error);
          else console.log('Admin approval email to employee sent:', info.response);
        });
      } catch (e) { console.error('Notify on admin approval error:', e); }
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
      // Notify employee with admin info
      try {
        const userRes = await query('SELECT full_name, email FROM users WHERE id = $1', [lr.user_id]);
        const user = userRes.recordset[0];
        let adminDisplay = req.session.userEmail;
        try {
          const adminRes = await query('SELECT full_name FROM users WHERE email = $1', [req.session.userEmail]);
          if (adminRes.recordset[0] && adminRes.recordset[0].full_name) {
            adminDisplay = adminRes.recordset[0].full_name + ' (' + req.session.userEmail + ')';
          }
        } catch {}
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: 'smtp.office365.com',
          port: 587,
          secure: false,
          auth: { user: 'automation@maishabank.com', pass: 'test.test700' }
        });
        transporter.sendMail({
          from: 'automation@maishabank.com',
          to: user.email,
          subject: 'Your Leave Request was Rejected by Admin',
          text: `Your leave request (ID: ${id}) was rejected by Admin: ${adminDisplay}\nReason: ${comment}`
        }, (error, info) => {
          if (error) console.error('Admin rejection email to employee error:', error);
          else console.log('Admin rejection email to employee sent:', info.response);
        });
      } catch (e) { console.error('Notify on admin rejection error:', e); }
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
    // Get all users
    const usersResult = await query(
      `SELECT id, full_name, department FROM users ORDER BY full_name`
    );
    const users = usersResult.recordset;

    // Get all leave types
    const leaveTypesResult = await query(
      `SELECT id, name, default_days FROM leave_type ORDER BY id`
    );
    const leaveTypes = leaveTypesResult.recordset;

    // Get all balances
    const balancesResult = await query(
      `SELECT * FROM balance`
    );
    const balances = balancesResult.recordset;

    // Map balances for quick lookup
    const balanceMap = {};
    balances.forEach(b => {
      balanceMap[`${b.user_id}-${b.leave_type_id}`] = b;
    });

    // Build result: for each user, for each leave type, return balance or default
    const result = [];
    users.forEach(u => {
      leaveTypes.forEach(lt => {
        const key = `${u.id}-${lt.id}`;
        const bal = balanceMap[key] || {};
        result.push({
          user_id: u.id,
          full_name: u.full_name,
          department: u.department,
          leave_type_id: lt.id,
          leave_type: lt.name,
          remaining_days: bal.remaining_days != null ? bal.remaining_days : lt.default_days,
          accrued_days: lt.name.toLowerCase() === 'annual' ? (bal.accrued_days != null ? bal.accrued_days : 0) : undefined
        });
      });
    });
    res.json(result);
>>>>>>> d03d514 (Initial push: leave management system)
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db' });
  }
});

app.put('/api/balances/:userId/:leaveTypeId', requireAuth, async (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const userId = parseInt(req.params.userId);
  const leaveTypeId = parseInt(req.params.leaveTypeId);
<<<<<<< HEAD
  const { remaining_days } = req.body;

  try {
=======
  const { remaining_days, accrued_days } = req.body;

  try {
    // Always update both remaining_days and accrued_days if provided
    if (accrued_days !== undefined) {
      await query(
        `MERGE balance AS target
           USING (VALUES(@p0,@p1,@p2,@p3)) AS src(user_id, leave_type_id, remaining_days, accrued_days)
           ON target.user_id = src.user_id AND target.leave_type_id = src.leave_type_id
           WHEN MATCHED THEN UPDATE SET remaining_days = src.remaining_days, accrued_days = src.accrued_days
           WHEN NOT MATCHED THEN INSERT(user_id, leave_type_id, remaining_days, accrued_days) VALUES(src.user_id, src.leave_type_id, src.remaining_days, src.accrued_days);`,
        [userId, leaveTypeId, remaining_days ?? 0, accrued_days]
      );
      res.json({ ok: true });
      return;
    }
>>>>>>> d03d514 (Initial push: leave management system)
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

<<<<<<< HEAD
    const department = req.session.department;
    if (!department) return res.status(400).json({ error: 'department not set' });

=======
    // If Elizabeth Mungai, show all pending leave requests for all users
    if (req.session.userEmail === 'elizabeth.mungai@maishabank.com') {
      const result = await query(
        `SELECT lr.id, lr.days, lr.start_date, lr.end_date, lr.reason, lr.status,
                u.full_name, u.email, lt.name as leave_type
         FROM leave_requests lr
         JOIN users u ON u.id = lr.user_id
         JOIN leave_type lt ON lt.id = lr.leave_type_id
         WHERE lr.status = 'pending'
         ORDER BY lr.created_at DESC`
      );
      return res.json((result && result.recordset) || []);
    }
    const department = req.session.department;
    if (!department) return res.status(400).json({ error: 'department not set' });
>>>>>>> d03d514 (Initial push: leave management system)
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
<<<<<<< HEAD

=======
>>>>>>> d03d514 (Initial push: leave management system)
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
<<<<<<< HEAD
           WHEN NOT MATCHED THEN INSERT(name, hod_user_id) VALUES(src.name, src.hod_user_id);`,
=======
           WHEN NOT MATCHED THEN INSERT(name,hod_user_id) VALUES(src.name,src.hod_user_id);`,
>>>>>>> d03d514 (Initial push: leave management system)
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
<<<<<<< HEAD
=======
      // Find the current HOD for this department (if any)
>>>>>>> d03d514 (Initial push: leave management system)
      const deptCheck = await query(
        `SELECT hod_user_id FROM department WHERE name = $1`,
        [department]
      );
      if (deptCheck.recordset.length > 0 && deptCheck.recordset[0].hod_user_id && deptCheck.recordset[0].hod_user_id != id) {
<<<<<<< HEAD
        return res.status(400).json({ error: 'department already has HOD' });
      }

=======
        // Demote the old HOD to employee
        await query(
          `UPDATE users SET role = 'employee' WHERE id = $1`,
          [deptCheck.recordset[0].hod_user_id]
        );
      }
>>>>>>> d03d514 (Initial push: leave management system)
      await query(
        `UPDATE users SET full_name = $1, role = $2, department = $3 WHERE id = $4`,
        [full_name, role, department, id]
      );
<<<<<<< HEAD

=======
>>>>>>> d03d514 (Initial push: leave management system)
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
<<<<<<< HEAD

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

=======

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
      'RESET_PASSWORD',
      'user',
      id,
      `Password reset for user ID ${id}`
    );

    // Generate a one-time token for password change (valid 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    passwordResetTokens[token] = { userId: id, expiry: Date.now() + 60 * 60 * 1000 };

    res.json({ ok: true });

    // Send email notification (after response)
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: 'automation@maishabank.com',
        pass: 'test.test800'
      }
    });

    const link = `http://${req.headers.host}/api/password_change/${token}`;
    const mailOptions = {
      from: 'automation@maishabank.com',
      to: userEmail,
      subject: 'Password Reset Notification',
      text: `Your password has been reset by the admin.\n\nTo set a new password, click the link below (valid for 1 hour):\n${link}\n\nIf you did not request this, contact support.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Email error:', error);
      } else {
        console.log('Password reset email sent:', info.response);
      }
    });
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

>>>>>>> d03d514 (Initial push: leave management system)
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
<<<<<<< HEAD
  const { start_date, end_date } = req.body || req.query;
=======
  const { start_date, end_date } = req.query;
>>>>>>> d03d514 (Initial push: leave management system)
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

<<<<<<< HEAD
const PORT = process.env.PORT || 3003;
=======
const PORT = 8080;
>>>>>>> d03d514 (Initial push: leave management system)
app.listen(PORT, async () => {
  await initPool();
  await initDb();
  console.log(`Server started on http://localhost:${PORT}`);
});
