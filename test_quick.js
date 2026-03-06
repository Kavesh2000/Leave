/**
 * Simple test to verify the API and database are working
 */

const http = require('http');

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: body ? JSON.parse(body) : null
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function quickTest() {
  console.log('Testing API...\n');
  
  // Test 1: Login with correct credentials
  console.log('Test 1: Login with admin@example.com');
  let res = await makeRequest('POST', '/api/login', {
    email: 'admin@example.com',
    password: 'password'
  });
  console.log('  Status:', res.status);
  console.log('  Response:', JSON.stringify(res.body, null, 2));
  
  // Test 2: Login with wrong password
  console.log('\nTest 2: Login with wrong password');
  res = await makeRequest('POST', '/api/login', {
    email: 'admin@example.com',
    password: 'wrongpassword'
  });
  console.log('  Status:', res.status);
  console.log('  Response:', JSON.stringify(res.body, null, 2));
  
  // Test 3: Get leave types without auth
  console.log('\nTest 3: Get leave types (should be unauthorized)');
  res = await makeRequest('GET', '/api/leave_types');
  console.log('  Status:', res.status);
  console.log('  Response:', JSON.stringify(res.body, null, 2));
}

quickTest().catch(console.error);
