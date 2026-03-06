/**
 * Test script to verify the approval workflow: employee → HOD → admin
 * This tests the complete leave approval process
 */

const http = require('http');

// Helper to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
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
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body ? JSON.parse(body) : null
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Test cases
async function runTests() {
  let sessionCookie = '';
  let adminCookie = '';
  let hodCookie = '';
  let empCookie = '';
  let requestId = null;

  console.log('\n=== LEAVE MANAGEMENT APPROVAL WORKFLOW TEST ===\n');

  try {
    // 1. ADMIN LOGIN
    console.log('1. Admin login...');
    let res = await makeRequest('POST', '/api/login', {
      email: 'admin@example.com',
      password: '1234'
    });
    console.log('   Response:', res.body);
    if (!res.body || !res.body.id) throw new Error('Admin login failed: ' + JSON.stringify(res.body));
    adminCookie = res.headers['set-cookie']?.[0] || '';
    console.log('   ✓ Admin logged in (ID: ' + res.body.id + ')');

    // 2. HOD LOGIN
    console.log('\n2. HOD (ICT) login...');
    res = await makeRequest('POST', '/api/login', {
      email: 'hod_ict@example.com',
      password: '1234'
    });
    if (!res.body || !res.body.id) throw new Error('HOD login failed');
    hodCookie = res.headers['set-cookie']?.[0] || '';
    console.log('   ✓ HOD logged in (ID: ' + res.body.id + ', Dept: ' + res.body.department + ')');

    // 3. EMPLOYEE LOGIN
    console.log('\n3. Employee (ICT) login...');
    res = await makeRequest('POST', '/api/login', {
      email: 'stevaniah.kavela@example.com',
      password: '1234'
    });
    if (!res.body || !res.body.id) throw new Error('Employee login failed');
    empCookie = res.headers['set-cookie']?.[0] || '';
    console.log('   ✓ Employee logged in (ID: ' + res.body.id + ', Dept: ' + res.body.department + ')');

    // 4. EMPLOYEE APPLIES FOR LEAVE
    console.log('\n4. Employee applies for leave...');
    res = await makeRequest('POST', '/api/apply', {
      leave_type_id: 1,
      start_date: '2026-03-01',
      end_date: '2026-03-05',
      reason: 'Personal leave'
    }, { 'Cookie': empCookie });
    if (!res.body || !res.body.id) throw new Error('Leave application failed');
    requestId = res.body.id;
    console.log('   ✓ Leave request created (ID: ' + requestId + ')');

    // 5. CHECK LEAVE REQUEST STATUS (should be PENDING)
    console.log('\n5. Checking leave request status (should be PENDING)...');
    res = await makeRequest('GET', '/api/leave_requests', null, { 'Cookie': empCookie });
    let req = res.body.find(r => r.id === requestId);
    if (req.status !== 'pending') throw new Error('Request should be pending, got: ' + req.status);
    console.log('   ✓ Request status: ' + req.status);

    // 6. TRY ADMIN APPROVAL WITHOUT HOD (should FAIL)
    console.log('\n6. Testing admin approval without HOD approval (should FAIL)...');
    res = await makeRequest('POST', '/api/leave_requests/' + requestId + '/admin_action', {
      action: 'approve',
      comment: 'Trying to approve before HOD'
    }, { 'Cookie': adminCookie });
    if (res.status !== 400) throw new Error('Admin should not be able to approve pending request');
    console.log('   ✓ Correctly rejected: ' + res.body.error);

    // 7. HOD APPROVES THE REQUEST
    console.log('\n7. HOD approves the leave request...');
    res = await makeRequest('POST', '/api/leave_requests/' + requestId + '/hod_action', {
      action: 'approve',
      comment: 'Looks good'
    }, { 'Cookie': hodCookie });
    if (!res.body.ok) throw new Error('HOD approval failed');
    console.log('   ✓ HOD approved the request');

    // 8. CHECK STATUS AFTER HOD APPROVAL (should be HOD_APPROVED)
    console.log('\n8. Checking status after HOD approval (should be HOD_APPROVED)...');
    res = await makeRequest('GET', '/api/leave_requests', null, { 'Cookie': empCookie });
    req = res.body.find(r => r.id === requestId);
    if (req.status !== 'hod_approved') throw new Error('Request should be hod_approved, got: ' + req.status);
    console.log('   ✓ Request status: ' + req.status);

    // 9. ADMIN APPROVES THE REQUEST
    console.log('\n9. Admin approves the leave request...');
    res = await makeRequest('POST', '/api/leave_requests/' + requestId + '/admin_action', {
      action: 'approve',
      comment: 'Approved'
    }, { 'Cookie': adminCookie });
    if (!res.body.ok) throw new Error('Admin approval failed: ' + JSON.stringify(res.body));
    console.log('   ✓ Admin approved the request');

    // 10. CHECK STATUS AFTER ADMIN APPROVAL (should be ADMIN_APPROVED)
    console.log('\n10. Checking final status (should be ADMIN_APPROVED)...');
    res = await makeRequest('GET', '/api/leave_requests', null, { 'Cookie': empCookie });
    req = res.body.find(r => r.id === requestId);
    if (req.status !== 'admin_approved') throw new Error('Request should be admin_approved, got: ' + req.status);
    console.log('   ✓ Request status: ' + req.status);

    // 11. CHECK LEAVE BALANCE (should be deducted)
    console.log('\n11. Checking employee leave balance (should be deducted by 4 days)...');
    res = await makeRequest('GET', '/api/balances', null, { 'Cookie': empCookie });
    const annualBalance = res.body.find(b => b.leave_type === 'Annual');
    const expectedDays = 21 - 4; // 4 working days deducted
    if (annualBalance.remaining_days !== expectedDays) {
      throw new Error('Balance should be ' + expectedDays + ', got: ' + annualBalance.remaining_days);
    }
    console.log('   ✓ Balance deducted: ' + annualBalance.remaining_days + ' days remaining');

    // 12. TEST HOD REJECT
    console.log('\n12. Testing HOD rejection workflow...');
    res = await makeRequest('POST', '/api/apply', {
      leave_type_id: 1,
      start_date: '2026-04-01',
      end_date: '2026-04-02',
      reason: 'Test rejection'
    }, { 'Cookie': empCookie });
    const rejectTestId = res.body.id;
    console.log('   ✓ Created test leave request (ID: ' + rejectTestId + ')');

    res = await makeRequest('POST', '/api/leave_requests/' + rejectTestId + '/hod_action', {
      action: 'reject',
      comment: 'Cannot approve now'
    }, { 'Cookie': hodCookie });
    if (!res.body.ok) throw new Error('HOD rejection failed');
    console.log('   ✓ HOD rejected the request');

    res = await makeRequest('GET', '/api/leave_requests', null, { 'Cookie': empCookie });
    req = res.body.find(r => r.id === rejectTestId);
    if (req.status !== 'rejected') throw new Error('Request should be rejected, got: ' + req.status);
    console.log('   ✓ Request status: ' + req.status);

    // 13. WORKFLOW ENFORCEMENT: HOD cannot act on already approved request
    console.log('\n13. Testing HOD cannot re-act on approved request...');
    res = await makeRequest('POST', '/api/leave_requests/' + requestId + '/hod_action', {
      action: 'approve',
      comment: 'Try to re-approve'
    }, { 'Cookie': hodCookie });
    if (res.status !== 400) throw new Error('HOD should not be able to act on non-pending request');
    console.log('   ✓ Correctly rejected: ' + res.body.error);

    console.log('\n✅ ALL TESTS PASSED!\n');
    console.log('Approval workflow verified:');
    console.log('  1. Employee submits → pending');
    console.log('  2. HOD approves → hod_approved');
    console.log('  3. Admin approves → admin_approved');
    console.log('  4. Balance automatically deducted');
    console.log('  5. Workflow enforcement prevents skipping steps\n');

  } catch (error) {
    console.log('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
