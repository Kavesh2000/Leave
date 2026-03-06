# HOD Department Filtering Implementation

## Problem
When HODs logged into the system, they should only see **department records** (employees and leave requests) for their specific department, not the entire system.

## Solution Implemented

Added **two new API endpoints** that allow HODs to view their department's data:

### 1. GET `/api/department/employees`
**Purpose:** Display employees in the HOD's department with their leave balances

**Access:** HOD role only (403 Forbidden for others)

**Returns:**
```json
[
  {
    "id": 5,
    "full_name": "John Smith",
    "email": "john.smith@company.com",
    "leave_balances": {
      "Casual Leave": 8,
      "Sick Leave": 5,
      "Annual Leave": 15
    }
  },
  {
    "id": 6,
    "full_name": "Jane Doe",
    "email": "jane.doe@company.com",
    "leave_balances": {
      "Casual Leave": 10,
      "Sick Leave": 4,
      "Annual Leave": 18
    }
  }
]
```

**Usage in Frontend:** Populates the "📊 Department Records" tab in the HOD dashboard

---

### 2. GET `/api/department/leave-records`
**Purpose:** Display all leave requests for employees in the HOD's department

**Access:** HOD role only (403 Forbidden for others)

**Returns:**
```json
[
  {
    "id": 42,
    "days": 5,
    "start_date": "2026-02-10",
    "end_date": "2026-02-14",
    "reason": "Medical checkup",
    "status": "pending",
    "full_name": "John Smith",
    "email": "john.smith@company.com",
    "leave_type": "Casual Leave"
  },
  {
    "id": 43,
    "days": 3,
    "start_date": "2026-02-20",
    "end_date": "2026-02-22",
    "reason": "Family emergency",
    "status": "hod_approved",
    "full_name": "Jane Doe",
    "email": "jane.doe@company.com",
    "leave_type": "Sick Leave"
  }
]
```

**Usage in Frontend:** Populates the "📋 All Leave Requests" tab in the HOD dashboard

---

## How It Works

### Data Filtering
Both endpoints filter by the HOD's department from their session:
```javascript
const department = req.session.department;
// Query where u.department = @dept
```

### Permission Model
- **Employees:** Cannot access these endpoints (only see their own data)
- **HODs:** Can only see their own department's data
- **Admins:** Cannot access these endpoints (they use different admin endpoints)

### Left Balances Calculation
The employees endpoint automatically:
1. Retrieves all leave types from the system
2. Gets the remaining balance for each employee
3. Uses default values when no custom balance exists yet

---

## Technical Details

### Endpoint Locations in server.js
- **Line ~720:** GET `/api/department/employees` endpoint
- **Line ~753:** GET `/api/department/leave-records` endpoint

### Database Queries
- Filters by `users.department = HOD's department`
- Joins with `leave_type`, `balance`, and `leave_requests` tables
- Returns data ordered by relevance (by name for employees, by date for requests)

### Security
- Role-based access control (HOD only)
- Department filtering prevents data leakage
- Proper error handling with 403 Forbidden responses

---

## Frontend Integration

**File:** `public/hod.html`

The HOD dashboard already calls these endpoints:

```javascript
// Line 132: Load employee records when clicking "Department Records" tab
async function loadEmployeeRecords() {
  const res = await fetch('/api/department/employees');
  const employees = await res.json();
  // ... displays in table format ...
}

// Line 156: Load leave requests when clicking "All Leave Requests" tab
async function loadAllRequests() {
  const res = await fetch('/api/department/leave-records');
  const requests = await res.json();
  // ... displays in table format ...
}
```

---

## Testing

Test login with actual HOD credentials:
```
Email: elizabeth.mungai@maishabank.com
Department: Finance
```

Then access the HOD dashboard at `http://localhost:3001/hod.html`

The tabs should now:
1. **Approval Queue** - Shows pending leave requests from their department
2. **Department Records** - Shows employees in Finance department with their leave balances  
3. **All Leave Requests** - Shows all leave requests from Finance department

---

## Summary

✅ HODs now see **only their department's data**
✅ Employees in other departments **cannot be viewed** by other HODs
✅ Both employees and leave records are **department-filtered**
✅ Leave balances are **automatically calculated** for each employee
✅ **Role-based access control** prevents unauthorized access

This implementation ensures **proper data isolation** and gives HODs the **right level of visibility** to manage their departments effectively.
