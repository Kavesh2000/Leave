const http = require('http');

async function testHODApprovalButtons() {
  return new Promise((resolve) => {
    // Step 1: Login as employee and apply for leave
    console.log('Step 1: Employee applies for leave...');
    const empLoginData = JSON.stringify({email: 'stevaniah.kavela@maishabank.com', password: '1234'});
    
    const empLoginReq = http.request({
      hostname: 'localhost', port: 3001, path: '/api/login', method: 'POST',
      headers: {'Content-Type': 'application/json', 'Content-Length': empLoginData.length}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        const cookies = res.headers['set-cookie'];
        const empCookie = cookies ? cookies[0] : '';
        
        console.log(`✓ Employee logged in: ${result.full_name}`);
        
        // Apply for leave
        setTimeout(() => {
          const applyData = JSON.stringify({
            leave_type_id: 1,
            start_date: '2026-03-10',
            end_date: '2026-03-12',
            reason: 'Test leave for approval'
          });
          
          const applyReq = http.request({
            hostname: 'localhost', port: 3001, path: '/api/apply', method: 'POST',
            headers: {'Content-Type': 'application/json', 'Content-Length': applyData.length, 'Cookie': empCookie}
          }, (res2) => {
            let data2 = '';
            res2.on('data', (chunk) => data2 += chunk);
            res2.on('end', () => {
              const applyResult = JSON.parse(data2);
              console.log(`✓ Leave request created (ID: ${applyResult.id})`);
              
              // Step 2: Login as HOD and check requests
              console.log('\nStep 2: HOD checks leave requests...');
              const hodLoginData = JSON.stringify({email: 'eric.mokaya@maishabank.com', password: '1234'});
              
              setTimeout(() => {
                const hodLoginReq = http.request({
                  hostname: 'localhost', port: 3001, path: '/api/login', method: 'POST',
                  headers: {'Content-Type': 'application/json', 'Content-Length': hodLoginData.length}
                }, (res3) => {
                  let data3 = '';
                  res3.on('data', (chunk) => data3 += chunk);
                  res3.on('end', () => {
                    const hodResult = JSON.parse(data3);
                    const cookies2 = res3.headers['set-cookie'];
                    const hodCookie = cookies2 ? cookies2[0] : '';
                    console.log(`✓ HOD logged in: ${hodResult.full_name}`);
                    
                    // Get leave requests
                    setTimeout(() => {
                      const requestsReq = http.request({
                        hostname: 'localhost', port: 3001, path: '/api/leave_requests', method: 'GET',
                        headers: {'Cookie': hodCookie}
                      }, (res4) => {
                        let data4 = '';
                        res4.on('data', (chunk) => data4 += chunk);
                        res4.on('end', () => {
                          const requests = JSON.parse(data4);
                          console.log(`\n✓ Fetched ${requests.length} leave request(s)`);
                          
                          const pendingRequests = requests.filter(r => r.status === 'pending');
                          console.log(`  - Pending requests: ${pendingRequests.length}`);
                          
                          if(pendingRequests.length > 0) {
                            pendingRequests.forEach(req => {
                              console.log(`\n  Request Details:`);
                              console.log(`    Employee: ${req.full_name}`);
                              console.log(`    Status: ${req.status}`);
                              console.log(`    Leave Type: ${req.leave_type}`);
                              console.log(`    Days: ${req.days}`);
                              console.log(`    Period: ${req.start_date} → ${req.end_date}`);
                              console.log(`\n  ✓ HOD should see APPROVE and REJECT buttons for this request`);
                            });
                          } else {
                            console.log('  ✗ No pending requests found');
                          }
                          
                          resolve();
                        });
                      });
                      requestsReq.end();
                    }, 100);
                  });
                });
                hodLoginReq.write(hodLoginData);
                hodLoginReq.end();
              }, 100);
            });
          });
          applyReq.write(applyData);
          applyReq.end();
        }, 100);
      });
    });
    empLoginReq.write(empLoginData);
    empLoginReq.end();
  });
}

testHODApprovalButtons();
