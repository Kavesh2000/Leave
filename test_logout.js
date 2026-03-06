const http = require('http');

async function testLogout() {
  return new Promise((resolve) => {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    const loginData = JSON.stringify({email: 'stevaniah.kavela@maishabank.com', password: '1234'});
    
    const loginOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    };
    
    const loginReq = http.request(loginOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const loginResult = JSON.parse(data);
        const cookies = res.headers['set-cookie'];
        console.log(`✓ Logged in as: ${loginResult.full_name}`);
        console.log(`  Session cookie: ${cookies ? 'Received' : 'Not received'}`);
        
        // Step 2: Check authenticated status
        console.log('\nStep 2: Checking authenticated status...');
        const sessionCookie = cookies ? cookies[0] : '';
        
        const checkOptions = {
          hostname: 'localhost',
          port: 3001,
          path: '/api/me',
          method: 'GET',
          headers: {
            'Cookie': sessionCookie
          }
        };
        
        const checkReq = http.request(checkOptions, (checkRes) => {
          let checkData = '';
          checkRes.on('data', (chunk) => checkData += chunk);
          checkRes.on('end', () => {
            if(checkRes.statusCode === 200) {
              const meResult = JSON.parse(checkData);
              console.log(`✓ Authenticated as: ${meResult.full_name} (${meResult.role})`);
            } else {
              console.log(`✗ Not authenticated (status: ${checkRes.statusCode})`);
              resolve();
              return;
            }
            
            // Step 3: Logout
            console.log('\nStep 3: Logging out...');
            const logoutOptions = {
              hostname: 'localhost',
              port: 3001,
              path: '/api/logout',
              method: 'POST',
              headers: {
                'Cookie': sessionCookie,
                'Content-Length': 0
              }
            };
            
            const logoutReq = http.request(logoutOptions, (logoutRes) => {
              let logoutData = '';
              logoutRes.on('data', (chunk) => logoutData += chunk);
              logoutRes.on('end', () => {
                if(logoutRes.statusCode === 200) {
                  console.log('✓ Logout successful');
                } else {
                  console.log(`✗ Logout failed (status: ${logoutRes.statusCode})`);
                }
                
                // Step 4: Try to access authenticated endpoint after logout
                console.log('\nStep 4: Checking if session is cleared...');
                const afterLogoutOptions = {
                  hostname: 'localhost',
                  port: 3001,
                  path: '/api/me',
                  method: 'GET',
                  headers: {
                    'Cookie': sessionCookie
                  }
                };
                
                const afterReq = http.request(afterLogoutOptions, (afterRes) => {
                  console.log(`After logout status: ${afterRes.statusCode}`);
                  if(afterRes.statusCode === 401) {
                    console.log('✓ Session properly cleared - user is unauthenticated');
                  } else {
                    console.log('✗ User still authenticated after logout');
                  }
                  
                  resolve();
                });
                
                afterReq.on('error', () => resolve());
                afterReq.end();
              });
            });
            
            logoutReq.on('error', () => resolve());
            logoutReq.end();
          });
        });
        
        checkReq.on('error', () => resolve());
        checkReq.end();
      });
    });
    
    loginReq.on('error', (e) => {
      console.log('Error:', e.message);
      resolve();
    });
    
    loginReq.write(loginData);
    loginReq.end();
  });
}

testLogout();
