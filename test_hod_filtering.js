// Test HOD department filtering endpoints
const http = require('http');

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
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
      resolve({ error: e.message });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('Testing HOD Department Filtering...\n');

  // Step 1: Login as HOD
  console.log('Step 1: Logging in as HOD...');
  const loginRes = await makeRequest('POST', '/api/login', {
    email: 'marketing.hod@maishabank.com',
    password: 'HOD@123'
  });
  
  if (loginRes.status !== 200) {
    console.error('✗ HOD Login failed:', loginRes.body);
    console.log('\nTrying with different HOD credentials...');
    
    // Try to list some users first to find a HOD
    const usersRes = await makeRequest('POST', '/api/login', {
      email: 'admin@maishabank.com',
      password: 'Admin@123'
    });
    
    if (usersRes.status === 200) {
      console.log('✓ Admin login successful');
    }
    process.exit(1);
  }

  console.log('✓ HOD Login successful');
  const sessionCookie = loginRes.headers['set-cookie'];
  console.log('  Department:', loginRes.body.department);

  // Step 2: Fetch department employees
  console.log('\nStep 2: Fetching department employees...');
  const empRes = await makeRequest('GET', '/api/department/employees', null, {
    'Cookie': sessionCookie?.[0] || ''
  });

  console.log('Status:', empRes.status);
  if (empRes.status === 200) {
    console.log('✓ Employee records retrieved');
    console.log(`  Found ${empRes.body.length} employees in department`);
    if (empRes.body.length > 0) {
      console.log('  Sample employee:', empRes.body[0]);
    }
  } else {
    console.log('✗ Error:', empRes.body);
  }

  // Step 3: Fetch department leave records
  console.log('\nStep 3: Fetching department leave records...');
  const leaveRes = await makeRequest('GET', '/api/department/leave-records', null, {
    'Cookie': sessionCookie?.[0] || ''
  });

  console.log('Status:', leaveRes.status);
  if (leaveRes.status === 200) {
    console.log('✓ Leave records retrieved');
    console.log(`  Found ${leaveRes.body.length} leave requests in department`);
    if (leaveRes.body.length > 0) {
      const sample = leaveRes.body[0];
      console.log('  Sample record:', {
        employee: sample.full_name,
        leaveType: sample.leave_type,
        days: sample.days,
        status: sample.status
      });
    }
  } else {
    console.log('✗ Error:', leaveRes.body);
  }

  console.log('\n✓ HOD department filtering test complete!');
}

test();
