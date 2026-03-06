const http = require('http');

async function testLogin(email, password) {
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
          console.log(`[${res.statusCode}] ${email}:${password} → ${JSON.stringify(result)}`);
          resolve(result);
        } catch(e) {
          console.log(`[ERROR] ${email}:${password} → Parse error`);
          resolve(null);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`[ERROR] ${email}:${password} → ${e.message}`);
      resolve(null);
    });
    
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('Testing various login credentials:\n');
  
  // Test different email formats
  const tests = [
    ['admin@example.com', '1234'],
    ['stevaniah.kavela@example.com', '1234'],
    ['Stevaniah.Kavela@example.com', '1234'],  // wrong case
    ['stevaniah@example.com', '1234'],  // wrong email
    ['stevaniah.kavela@example.com', 'password'],  // wrong password
    ['stevaniah.kavela@example.com', '12345'],  // wrong password
    ['hod_ict@example.com', '1234'],
  ];
  
  for (const [email, pwd] of tests) {
    await testLogin(email, pwd);
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log('\n✅ Login tests completed');
}

runTests();
