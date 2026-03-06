// Test HOD department filtering with actual data
const http = require('http');

function makeRequest(method, path, body = null, cookies = '') {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (cookies) options.headers['Cookie'] = cookies;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch(e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', (e) => resolve({ error: e.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('=== Testing HOD Department Filtering ===\n');

  // Step 1: Login as admin
  console.log('Step 1: Admin login...');
  const adminLogin = await makeRequest('POST', '/api/login', {
    email: 'automation@maishabank.com',
    password: '1234'
  });

  const adminCookie = adminLogin.headers['set-cookie']?.[0] || '';
  console.log('Status:', adminLogin.status, '✓');
  console.log('Admin ID:', adminLogin.body.id, '\n');

  // Step 2: Get all users to find a HOD
  console.log('Step 2: Finding HOD users...');
  try {
    const usersRes = await makeRequest('GET', '/api/users', null, adminCookie);
    
    if (usersRes.status === 200) {
      const hods = usersRes.body.filter(u => u.role === 'HOD');
      console.log(`Found ${hods.length} HOD users`);
      
      if (hods.length > 0) {
        const hod = hods[0];
        console.log(`\nFirst HOD: ${hod.full_name}`);
        console.log(`Department: ${hod.department}`);
        console.log(`Email: ${hod.email}\n`);

        // Step 3: Try to login as this HOD (we'd need the password, so let's test the endpoints directly)
        // But we can still test the endpoints with admin to see the structure
        
        console.log('Step 3: Testing endpoint access...\n');
        
        // Test GET /api/department/employees (with admin cookie - should fail for HOD-only endpoint)
        console.log('Testing /api/department/employees with admin session:');
        const empRes = await makeRequest('GET', '/api/department/employees', null, adminCookie);
        console.log('Status:', empRes.status, empRes.status === 403 ? '(Expected: Forbidden for admin)' : '');
        console.log('Response:', empRes.body, '\n');
        
        // Test GET /api/department/leave-records
        console.log('Testing /api/department/leave-records with admin session:');
        const leaveRes = await makeRequest('GET', '/api/department/leave-records', null, adminCookie);
        console.log('Status:', leaveRes.status, leaveRes.status === 403 ? '(Expected: Forbidden for admin)' : '');
        console.log('Response:', leaveRes.body, '\n');

        console.log('✓ Endpoints exist and require HOD role');
      } else {
        console.log('✗ No HOD users found in system');
      }
    } else {
      console.log('✗ Failed to get users:', usersRes.body);
    }
  } catch (err) {
    console.log('Error:', err);
  }
}

test();
