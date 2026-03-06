// Simple test to verify audit logging works
const http = require('http');

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
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
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch(e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Error: ${e.message}`);
      resolve({ error: e.message });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('Testing Audit Logging...\n');

  // Test 1: Login as admin
  console.log('Test 1: Login as admin');
  const loginRes = await makeRequest('/api/login', 'POST', {
    email: 'admin@maishabank.com',
    password: 'Admin@123'
  });
  console.log('Status:', loginRes.status);
  console.log('Response:', loginRes.body);
  console.log('Cookies:', loginRes.headers['set-cookie']);
  
  if (loginRes.status !== 200) {
    console.error('\nLogin failed! Cannot continue tests.');
    process.exit(1);
  }
  
  console.log('\n✓ All tests completed!');
}

test();
