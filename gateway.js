const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'unified-gateway-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Static files for gateway UI
app.use(express.static(path.join(__dirname, 'gateway-public')));

// Helper function to proxy requests
function proxyRequest(targetUrl, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// ===== AUTH ROUTES =====

app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, 'gateway-public', 'login.html'));
});

app.post('/api/gateway/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Try Leave system first
    const leaveResponse = await proxyRequest(
      `http://localhost:3001/api/login`,
      'POST',
      { email, password }
    );

    if (leaveResponse.status === 200 && leaveResponse.data.id) {
      req.session.userId = leaveResponse.data.id;
      req.session.userEmail = email;
      req.session.userName = leaveResponse.data.full_name;
      req.session.userRole = leaveResponse.data.role;
      req.session.department = leaveResponse.data.department;

      return res.json({
        ok: true,
        user: {
          id: leaveResponse.data.id,
          name: leaveResponse.data.full_name,
          email: email,
          role: leaveResponse.data.role,
          department: leaveResponse.data.department
        }
      });
    }

    // Try Ticketing system if leave system fails
    const ticketingResponse = await proxyRequest(
      `http://localhost:3003/api/login`,
      'POST',
      { email, password }
    );

    if (ticketingResponse.status === 200 && ticketingResponse.data.id) {
      req.session.userId = ticketingResponse.data.id;
      req.session.userEmail = email;
      req.session.userName = ticketingResponse.data.full_name;
      req.session.userRole = ticketingResponse.data.role;

      return res.json({
        ok: true,
        user: {
          id: ticketingResponse.data.id,
          name: ticketingResponse.data.full_name,
          email: email,
          role: ticketingResponse.data.role
        }
      });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'gateway-public', 'dashboard.html'));
});

app.get('/api/gateway/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    id: req.session.userId,
    email: req.session.userEmail,
    name: req.session.userName,
    role: req.session.userRole,
    department: req.session.department
  });
});

app.post('/api/gateway/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ ok: true });
  });
});

// ===== SYSTEM REDIRECT ROUTES =====

app.get('/api/gateway/leave-access', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Redirect to leave system with session info
  res.json({
    ok: true,
    redirect: 'http://localhost:3001/employee.html',
    accessToken: Buffer.from(JSON.stringify({
      userId: req.session.userId,
      email: req.session.userEmail,
      role: req.session.userRole
    })).toString('base64')
  });
});

app.get('/api/gateway/ticket-access', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Redirect to ticketing system
  res.json({
    ok: true,
    redirect: 'http://localhost:3003/system.html',
    accessToken: Buffer.from(JSON.stringify({
      userId: req.session.userId,
      email: req.session.userEmail,
      role: req.session.userRole
    })).toString('base64')
  });
});

// ===== PROXY ROUTES =====

// Proxy leave system API calls
app.use('/leave-api/', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const target = `http://localhost:3001${req.originalUrl.replace('/leave-api', '')}`;
  proxyRequest(target, req.method, req.body)
    .then(result => res.status(result.status).json(result.data))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Proxy ticketing system API calls
app.use('/ticket-api/', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const target = `http://localhost:3003${req.originalUrl.replace('/ticket-api', '')}`;
  proxyRequest(target, req.method, req.body)
    .then(result => res.status(result.status).json(result.data))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ Unified Gateway Server running on http://localhost:${PORT}`);
  console.log(`\n📋 Leave System: http://localhost:3001`);
  console.log(`🎫 Ticketing System: http://localhost:3003`);
  console.log(`\n🔗 Access unified portal at: http://localhost:${PORT}\n`);
});
