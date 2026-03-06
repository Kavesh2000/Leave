// Simple test to check available users
const http = require('http');

function makeRequest(method, path, body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (e) => resolve({ error: e.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('Checking server connectivity...\n');

  // Test 1: Check if server responds
  console.log('Test: Home page');
  const homeRes = await makeRequest('GET', '/');
  console.log('Status:', homeRes.status);

  // Test 2: Try admin login
  console.log('\nTest: Admin Login');
  const adminLogin = await makeRequest('POST', '/api/login', {
    email: 'automation@maishabank.com',
    password: '1234'
  });
  console.log('Status:', adminLogin.status);
  console.log('Response:', adminLogin.body);

  if (adminLogin.status === 200) {
    console.log('✓ Automation user login successful');
  }
}

test();
