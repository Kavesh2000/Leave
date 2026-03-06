# Approval Workflow Testing Guide

## Quick Test

Run this command to verify the entire approval workflow automatically:

```bash
npm start  # Start server (if not already running)
node test_approval_workflow.js
```

You should see output like:
```
=== LEAVE MANAGEMENT APPROVAL WORKFLOW TEST ===

1. Admin login...
   ✓ Admin logged in (ID: 1)

2. HOD (Engineering) login...
   ✓ HOD logged in (ID: 2, Dept: Engineering)

3. Employee login...
   ✓ Employee logged in (ID: 7, Dept: Engineering)

... (more tests) ...

✅ ALL TESTS PASSED!

Approval workflow verified:
  1. Employee submits → pending
  2. HOD approves → hod_approved
  3. Admin approves → admin_approved
  4. Balance automatically deducted
  5. Workflow enforcement prevents skipping steps
```

## Manual Testing

### Scenario 1: Complete Approval Flow

1. **Start Fresh:**
   ```bash
   npm start
   ```

2. **Log in as Employee** (emp@example.com / password)
   - Go to http://localhost:3001/employee.html
   - Apply for leave: March 1-5, 2026 (Annual, 4 days)
   - Click Submit

3. **Log in as HOD** (hod@example.com / password)
   - Go to http://localhost:3001/hod.html
   - See the pending request in "⏳ PENDING" section
   - Click "Approve" or "Reject"
   - Add a comment and submit

4. **Log in as Admin** (admin@example.com / password)
   - Go to http://localhost:3001/admin.html
   - See the request with status "✓ HOD Approved (Ready for Admin)"
   - Click "Approve" or "Reject"
   - Add a comment and submit

5. **Verify:**
   - Employee sees final status: "✅ Approved"
   - Employee balance was deducted (21 → 17 days)
   - Admin dashboard shows "25 total days approved" in analytics

### Scenario 2: Admin Cannot Skip HOD

1. **Employee applies for leave** (Status: pending)

2. **Try to approve as Admin BEFORE HOD:**
   - Go to Admin dashboard
   - Click "Approve" on the pending request
   - Expected: Error message appears
   - "Cannot approve: request must be in "hod_approved" status, currently: "pending""

3. **Then have HOD approve:**
   - HOD approves the request
   - Status changes to "hod_approved"

4. **Now admin can approve:**
   - Admin can now see action buttons
   - Admin approves successfully

### Scenario 3: HOD Cannot Re-approve

1. **Employee applies** → Status: pending
2. **HOD approves** → Status: hod_approved
3. **Admin approves** → Status: admin_approved
4. **Try HOD action again:**
   - HOD tries to click approve/reject on same request
   - Expected: Error message
   - "Cannot approve/reject: request must be in "pending" status"

## What the Tests Verify

### ✅ Workflow Enforcement
- Employees can only submit in pending status
- HODs can only act on pending requests
- Admins can only approve hod_approved requests
- No role can skip or override workflow steps

### ✅ Status Transitions
- pending → hod_approved (HOD approves)
- pending → rejected (HOD rejects)
- hod_approved → admin_approved (Admin approves)
- hod_approved → rejected (Admin rejects)
- pending → rejected (Admin rejects)

### ✅ Balance Management
- Balance is only deducted on admin_approved status
- Correct number of working days calculated
- Balance cannot go negative

### ✅ Audit Trail
- hod_comment is saved when HOD acts
- admin_comment is saved when Admin acts
- updated_at timestamp tracks each change

### ✅ Department Restrictions
- HODs only see their department's requests
- HODs cannot approve requests from other departments
- Admins see all requests

## Common Issues and Solutions

### Issue: Tests fail with "Admin login failed"
**Solution:** Database not initialized. Run:
```bash
npm start
# Wait 2 seconds for database to initialize
# Kill with Ctrl+C
rm data.sqlite  # or delete data.sqlite on Windows
npm start  # Restart, database will be re-seeded
```

### Issue: "Address already in use 3001"
**Solution:** Kill existing Node process and retry:
```bash
# Windows (PowerShell)
Get-Process -Name node | Stop-Process -Force

# Then restart
npm start
```

### Issue: Leave balance shows wrong number
**Solution:** 
- Verify dates are working days (Mon-Fri)
- Holidays in 2026: Jan 1, Dec 25
- 5 working days in a week, except holidays

Example dates:
- Mar 1-2 (Sun-Mon) = 1 day
- Mar 1-5 (Sun-Fri) = 4 days (excluding Sunday)
- Mar 1-8 (Sun-Sun) = 5 days (Mon-Fri)

## Files Modified

1. **server.js**
   - `/api/leave_requests/:id/hod_action` - Added pending status check
   - `/api/leave_requests/:id/admin_action` - Added hod_approved status check

2. **public/hod.html**
   - Updated UI to show pending and history sections separately
   - Improved error display

3. **public/admin.html**
   - Updated status labels for clarity
   - Improved error handling

## Integration with Existing System

The approval workflow improvements are **backward compatible**:
- All existing requests data is preserved
- No database schema changes required
- Frontend improvements are visual only
- API error codes are consistent

## Next Steps (Optional Enhancements)

1. **Email notifications** when requests move between statuses
2. **Bulk approval** for HOD to approve multiple requests
3. **Deadline reminders** for pending approvals
4. **Request history** search and filter by date
5. **Custom workflows** for different leave types (e.g., medical needs manager only)
