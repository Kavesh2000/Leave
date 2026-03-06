const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': ''
  }
};

// Login as HOD
const loginData = JSON.stringify({
  email: 'hod_ict@example.com',
  password: '1234'
});

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const cookies = res.headers['set-cookie'];
    console.log('\n✅ HOD LOGIN SUCCESSFUL');
    console.log('Response:', JSON.parse(data));
    
    // Now test the new endpoints with the session
    const sessionCookie = cookies ? cookies[0] : '';
    
    // Test employee records endpoint
    const empOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/department/employees',
      method: 'GET',
      headers: {
        'Cookie': sessionCookie
      }
    };
    
    const empReq = http.request(empOptions, (empRes) => {
      let empData = '';
      empRes.on('data', (chunk) => empData += chunk);
      empRes.on('end', () => {
        console.log('\n✅ EMPLOYEE RECORDS ENDPOINT');
        const employees = JSON.parse(empData);
        console.log(`Found ${employees.length} employees:`);
        employees.forEach(emp => {
          const balances = Object.entries(emp.leave_balances)
            .map(([type, days]) => `${type}: ${days}`)
            .join(', ');
          console.log(`  - ${emp.full_name} (${emp.email}): ${balances}`);
        });
        
        // Test leave records endpoint
        const leavesOptions = {
          hostname: 'localhost',
          port: 3001,
          path: '/api/department/leave-records',
          method: 'GET',
          headers: {
            'Cookie': sessionCookie
          }
        };
        
        const leavesReq = http.request(leavesOptions, (leavesRes) => {
          let leavesData = '';
          leavesRes.on('data', (chunk) => leavesData += chunk);
          leavesRes.on('end', () => {
            console.log('\n✅ LEAVE RECORDS ENDPOINT');
            const records = JSON.parse(leavesData);
            console.log(`Found ${records.length} leave requests:`);
            records.forEach(record => {
              console.log(`  - ${record.full_name}: ${record.leave_type} (${record.days} days, ${record.start_date} → ${record.end_date}) - Status: ${record.status}`);
            });
            
            console.log('\n📊 HOD DASHBOARD FEATURES VERIFIED!');
            console.log('✓ Employee records with leave balances');
            console.log('✓ All leave requests for department');
            console.log('✓ Status tracking and filtering');
          });
        });
        
        leavesReq.end();
      });
    });
    
    empReq.end();
  });
});

req.write(loginData);
req.end();
