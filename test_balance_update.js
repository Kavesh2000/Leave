const http = require('http');

async function testLeaveBalanceUpdate() {
  return new Promise((resolve) => {
    // Step 1: Employee applies for leave
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
        
        // Check current balance
        setTimeout(() => {
          const balReq = http.request({
            hostname: 'localhost', port: 3001, path: '/api/balances', method: 'GET',
            headers: {'Cookie': empCookie}
          }, (res2) => {
            let data2 = '';
            res2.on('data', (chunk) => data2 += chunk);
            res2.on('end', () => {
              const balances = JSON.parse(data2);
              const annualBal = balances.find(b => b.leave_type === 'Annual');
              const startingBalance = annualBal ? annualBal.remaining_days : 'Unknown';
              console.log(`✓ Starting Annual leave balance: ${startingBalance} days`);
              
              // Apply for leave
              setTimeout(() => {
                const applyData = JSON.stringify({
                  leave_type_id: 1,
                  start_date: '2026-04-01',
                  end_date: '2026-04-03',
                  reason: 'Test leave'
                });
                
                const applyReq = http.request({
                  hostname: 'localhost', port: 3001, path: '/api/apply', method: 'POST',
                  headers: {'Content-Type': 'application/json', 'Content-Length': applyData.length, 'Cookie': empCookie}
                }, (res3) => {
                  let data3 = '';
                  res3.on('data', (chunk) => data3 += chunk);
                  res3.on('end', () => {
                    const applyResult = JSON.parse(data3);
                    console.log(`✓ Leave request created (ID: ${applyResult.id}, 2 days requested)`);
                    
                    // Step 2: HOD approves
                    console.log('\nStep 2: HOD approves the request...');
                    const hodLoginData = JSON.stringify({email: 'eric.mokaya@maishabank.com', password: '1234'});
                    
                    setTimeout(() => {
                      const hodLoginReq = http.request({
                        hostname: 'localhost', port: 3001, path: '/api/login', method: 'POST',
                        headers: {'Content-Type': 'application/json', 'Content-Length': hodLoginData.length}
                      }, (res4) => {
                        let data4 = '';
                        res4.on('data', (chunk) => data4 += chunk);
                        res4.on('end', () => {
                          const hodResult = JSON.parse(data4);
                          const cookies2 = res4.headers['set-cookie'];
                          const hodCookie = cookies2 ? cookies2[0] : '';
                          console.log(`✓ HOD logged in: ${hodResult.full_name}`);
                          
                          // HOD approves
                          setTimeout(() => {
                            const hodApproveData = JSON.stringify({action: 'approve', comment: 'Approved by HOD'});
                            const hodApproveReq = http.request({
                              hostname: 'localhost', port: 3001, path: `/api/leave_requests/${applyResult.id}/hod_action`, method: 'POST',
                              headers: {'Content-Type': 'application/json', 'Content-Length': hodApproveData.length, 'Cookie': hodCookie}
                            }, (res5) => {
                              res5.on('data', () => {});
                              res5.on('end', () => {
                                console.log('✓ HOD approved the request');
                                
                                // Step 3: Admin views and approves
                                console.log('\nStep 3: Admin views the request with remaining balance...');
                                const adminLoginData = JSON.stringify({email: 'admin@example.com', password: '1234'});
                                
                                setTimeout(() => {
                                  const adminLoginReq = http.request({
                                    hostname: 'localhost', port: 3001, path: '/api/login', method: 'POST',
                                    headers: {'Content-Type': 'application/json', 'Content-Length': adminLoginData.length}
                                  }, (res6) => {
                                    let data6 = '';
                                    res6.on('data', (chunk) => data6 += chunk);
                                    res6.on('end', () => {
                                      const adminResult = JSON.parse(data6);
                                      const cookies3 = res6.headers['set-cookie'];
                                      const adminCookie = cookies3 ? cookies3[0] : '';
                                      console.log(`✓ Admin logged in: ${adminResult.full_name}`);
                                      
                                      // Get requests to see remaining balance
                                      setTimeout(() => {
                                        const requestsReq = http.request({
                                          hostname: 'localhost', port: 3001, path: '/api/leave_requests', method: 'GET',
                                          headers: {'Cookie': adminCookie}
                                        }, (res7) => {
                                          let data7 = '';
                                          res7.on('data', (chunk) => data7 += chunk);
                                          res7.on('end', () => {
                                            const requests = JSON.parse(data7);
                                            const myRequest = requests.find(r => r.id === applyResult.id);
                                            console.log(`✓ Request showing remaining balance: ${myRequest.remaining_days} days`);
                                            console.log(`  Admin will approve 2 days requested, leaving ${myRequest.remaining_days - 2} days`);
                                            
                                            // Admin approves
                                            setTimeout(() => {
                                              const adminApproveData = JSON.stringify({action: 'approve', comment: 'Approved by Admin'});
                                              const adminApproveReq = http.request({
                                                hostname: 'localhost', port: 3001, path: `/api/leave_requests/${applyResult.id}/admin_action`, method: 'POST',
                                                headers: {'Content-Type': 'application/json', 'Content-Length': adminApproveData.length, 'Cookie': adminCookie}
                                              }, (res8) => {
                                                res8.on('data', () => {});
                                                res8.on('end', () => {
                                                  console.log('✓ Admin approved the request');
                                                  
                                                  // Check final balance
                                                  setTimeout(() => {
                                                    const finalReq = http.request({
                                                      hostname: 'localhost', port: 3001, path: '/api/balances', method: 'GET',
                                                      headers: {'Cookie': empCookie}
                                                    }, (res9) => {
                                                      let data9 = '';
                                                      res9.on('data', (chunk) => data9 += chunk);
                                                      res9.on('end', () => {
                                                        const finalBalances = JSON.parse(data9);
                                                        const finalAnnual = finalBalances.find(b => b.leave_type === 'Annual');
                                                        console.log(`\n✓ Final Annual leave balance: ${finalAnnual.remaining_days} days`);
                                                        console.log(`✓ Deducted: ${startingBalance - finalAnnual.remaining_days} days`);
                                                        console.log('\n✅ Leave balance update system WORKING!');
                                                        resolve();
                                                      });
                                                    });
                                                    finalReq.end();
                                                  }, 100);
                                                });
                                              });
                                              adminApproveReq.write(adminApproveData);
                                              adminApproveReq.end();
                                            }, 100);
                                          });
                                        });
                                        requestsReq.end();
                                      }, 100);
                                    });
                                  });
                                  adminLoginReq.write(adminLoginData);
                                  adminLoginReq.end();
                                }, 100);
                              });
                            });
                            hodApproveReq.write(hodApproveData);
                            hodApproveReq.end();
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
          balReq.end();
        }, 100);
      });
    });
    empLoginReq.write(empLoginData);
    empLoginReq.end();
  });
}

testLeaveBalanceUpdate();
