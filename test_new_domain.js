const http = require('http');

async function testLogin(email, password, expectedRole = null) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({email, password});
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if(result.id) {
            const roleMatch = !expectedRole || result.role === expectedRole;
            const status = roleMatch ? '✓' : '✗';
            console.log(`${status} ${result.full_name.padEnd(25)} | ${email.padEnd(35)} | Role: ${result.role.padEnd(10)} | Dept: ${result.department || 'N/A'}`);
          } else {
            console.log(`✗ FAILED: ${email} - ${result.error}`);
          }
          resolve(result);
        } catch(e) {
          console.log(`✗ ERROR: ${email} - Parse error`);
          resolve(null);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`✗ ERROR: ${email} - ${e.message}`);
      resolve(null);
    });
    
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== TESTING NEW CREDENTIALS (maishabank.com) ===\n');
  
  const tests = [
    // Admin
    ['admin@example.com', '1234', 'admin'],
    
    // ICT Department
    ['stevaniah.kavela@maishabank.com', '1234', 'employee'],
    ['mercy.mukhwana@maishabank.com', '1234', 'employee'],
    ['eric.mokaya@maishabank.com', '1234', 'HOD'],  // HOD
    
    // Branch Department  
    ['caroline.ngugi@maishabank.com', '1234', 'employee'],
    ['lilian.kimani@maishabank.com', '1234', 'employee'],
    ['maureen.kerubo@maishabank.com', '1234', 'employee'],
    ['alice.muthoni@maishabank.com', '1234', 'employee'],
    ['michael.mureithi@maishabank.com', '1234', 'HOD'],  // HOD
    
    // Finance Department
    ['patrick.ndegwa@maishabank.com', '1234', 'employee'],
    ['margaret.njeri@maishabank.com', '1234', 'employee'],
    ['elizabeth.mungai@maishabank.com', '1234', 'HOD'],  // HOD
    
    // Customer Service Department
    ['juliana.jeptoo@maishabank.com', '1234', 'employee'],
    ['faith.bonareri@maishabank.com', '1234', 'employee'],
    ['patience.mutunga@maishabank.com', '1234', 'HOD'],  // HOD
    ['eva.mukami@maishabank.com', '1234', 'employee'],
    ['peter.kariuki@maishabank.com', '1234', 'employee'],
  ];
  
  for (const [email, pwd, expectedRole] of tests) {
    await testLogin(email, pwd, expectedRole);
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log('\n=== VERIFICATION COMPLETE ===');
  console.log('\nHOD Assignments:');
  console.log('  ICT: eric.mokaya@maishabank.com');
  console.log('  Branch: michael.mureithi@maishabank.com');
  console.log('  Finance: elizabeth.mungai@maishabank.com');
  console.log('  Customer Service: patience.mutunga@maishabank.com');
}

runTests();
