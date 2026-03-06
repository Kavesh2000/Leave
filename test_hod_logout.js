const http = require('http');

async function testHODLogout() {
  return new Promise((resolve) => {
    // Login as HOD
    const loginData = JSON.stringify({email: 'eric.mokaya@maishabank.com', password: '1234'});
    
    const loginReq = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        const cookies = res.headers['set-cookie'];
        const sessionCookie = cookies ? cookies[0] : '';
        
        console.log('✓ HOD logged in as:', result.full_name, `(${result.role})`);
        
        // Verify session is active
        setTimeout(() => {
          const checkReq = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/me',
            method: 'GET',
            headers: { 'Cookie': sessionCookie }
          }, (res) => {
            let checkData = '';
            res.on('data', (chunk) => checkData += chunk);
            res.on('end', () => {
              if(res.statusCode === 200) {
                console.log('✓ Session active before logout');
                
                // Now logout
                const logoutReq = http.request({
                  hostname: 'localhost',
                  port: 3001,
                  path: '/api/logout',
                  method: 'POST',
                  headers: { 'Cookie': sessionCookie, 'Content-Length': 0 }
                }, (res2) => {
                  res2.on('data', () => {});
                  res2.on('end', () => {
                    console.log('✓ Logout request processed');
                    
                    // Try to access with old session
                    setTimeout(() => {
                      const testReq = http.request({
                        hostname: 'localhost',
                        port: 3001,
                        path: '/api/me',
                        method: 'GET',
                        headers: { 'Cookie': sessionCookie }
                      }, (res3) => {
                        res3.on('data', () => {});
                        res3.on('end', () => {
                          if(res3.statusCode === 401) {
                            console.log('✓ Session cleared - HOD logout SUCCESSFUL');
                          } else {
                            console.log('✗ Session still active - logout FAILED');
                          }
                          resolve();
                        });
                      });
                      testReq.end();
                    }, 100);
                  });
                });
                logoutReq.end();
              } else {
                console.log('✗ Session check failed');
                resolve();
              }
            });
          });
          checkReq.end();
        }, 100);
      });
    });
    
    loginReq.write(loginData);
    loginReq.end();
  });
}

testHODLogout();
