# Audit Logging Implementation Summary

## Overview
Successfully restored comprehensive audit logging to the Leave Management System database with the ability to query activities by specific employee.

## Components Implemented

### 1. Database Table: audit_logs
**Location:** initDb() function, line ~192

Schema:
```sql
CREATE TABLE audit_logs(
  id INT PRIMARY KEY IDENTITY(1,1),
  user_id INT,
  user_email NVARCHAR(255),
  action NVARCHAR(100),
  entity_type NVARCHAR(50),
  entity_id INT,
  details NVARCHAR(MAX),
  timestamp DATETIME DEFAULT GETDATE()
)
```

**Columns:**
- `id`: Auto-incrementing primary key
- `user_id`: ID of the user performing the action
- `user_email`: Email of the user performing the action
- `action`: Type of action (CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, ASSIGN, RESET_PASSWORD)
- `entity_type`: Type of entity being acted upon (user, leave_request, balance, hod, session)
- `entity_id`: ID of the entity being acted upon
- `details`: Description of the action with relevant context
- `timestamp`: When the action occurred (defaults to GETDATE())

### 2. Logging Function: logAudit()
**Location:** Line ~345-360

Signature:
```javascript
async function logAudit(userId, userEmail, action, entityType, entityId, details = null)
```

Features:
- Asynchronous operation for non-blocking performance
- Parameterized queries to prevent SQL injection
- Error handling to prevent logging failures from affecting main operations
- Includes both `user_id` and `user_email` for quick filtering

### 3. Audit Logging Points

Strategic logging added to critical events:

#### User Management:
- **CREATE** user operations (line 755 - admin, line 784 - HOD, line 806 - employee)
- **UPDATE** user operations (line 822)
- **DELETE** user operations (line 829)
- **RESET_PASSWORD** operations (line 1089)

#### Leave Requests:
- **CREATE** leave_request submissions (line 432)
- **APPROVE** by HOD (line 470)
- **REJECT** by HOD (line 481)
- **APPROVE** by Admin (line 562)
- **REJECT** by Admin (line 573)

#### Leave Balances:
- **UPDATE** balance adjustments (line 646)

#### Administrative:
- **ASSIGN** HOD positions (line 708)
- **LOGIN** sessions (line 398)

### 4. Query Endpoints

#### GET /api/audit-logs
**Protection:** Admin only (requireAuth + admin role check)
**Location:** Line 1101-1172

Query Parameters:
- `page`: Page number (default: 0)
- `limit`: Results per page (default: 50)
- `action`: Filter by action type (e.g., 'CREATE', 'APPROVE')
- `user_email`: Filter by actor's email
- `start_date`: Filter entries from this date onwards (ISO format)
- `end_date`: Filter entries up to this date (ISO format)

Response Format:
```json
{
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "user_email": "admin@maishabank.com",
      "action": "CREATE",
      "entity_type": "user",
      "entity_id": 18,
      "details": "Created employee: John Doe (john@test.com) in department Marketing",
      "timestamp": "2024-01-15T10:30:45.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 0,
    "limit": 50,
    "pages": 3
  }
}
```

#### GET /api/employee/:userId/activities
**Protection:** All authenticated users (with permission checks)
**Location:** Line 1173-1230

Permission Model:
- Admin: Can view anyone's activities
- HOD: Can view employees in their department
- Employee: Can view only their own activities

Query Parameters:
- `page`: Page number (default: 0)
- `limit`: Results per page (default: 50)

Response Format:
```json
{
  "data": [
    {
      "id": 5,
      "user_id": 10,
      "user_email": "john@test.com",
      "action": "CREATE",
      "entity_type": "leave_request",
      "entity_id": 42,
      "details": "Submitted leave request: 5 days from 2024-01-20 to 2024-01-24",
      "timestamp": "2024-01-15T09:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 23,
    "page": 0,
    "limit": 50,
    "pages": 1
  }
}
```

## Action Types Captured

| Action | Entity Type | Description |
|--------|------------|-------------|
| CREATE | user | New user created |
| UPDATE | user | User profile modified |
| DELETE | user | User account deleted |
| CREATE | leave_request | Leave request submitted |
| APPROVE | leave_request | Leave request approved (HOD or Admin) |
| REJECT | leave_request | Leave request rejected (HOD or Admin) |
| UPDATE | balance | Leave balance adjusted |
| ASSIGN | hod | HOD or Acting HOD assigned |
| LOGIN | session | User logged in |
| RESET_PASSWORD | user | Password reset by admin |

## Example Use Cases

### 1. Get all leave approvals by a specific HOD
```
GET /api/audit-logs?action=APPROVE&user_email=hod@dept.com&start_date=2024-01-01&end_date=2024-01-31
```

### 2. View all activities of a specific employee
```
GET /api/employee/5/activities
```

### 3. Get all user creations in the system
```
GET /api/audit-logs?action=CREATE&entity_type=user
```

### 4. Track all actions by an admin between dates
```
GET /api/audit-logs?user_email=admin@maishabank.com&start_date=2024-01-10&end_date=2024-01-20
```

## Data Persistence

- Audit logs are persisted separately from data initialization
- Logs are not cleared on server restart (unlike the old behavior)
- Only truncated on fresh database initialization
- Maintains complete audit trail for compliance and accountability

## API Security

- All audit endpoints require authentication (`requireAuth` middleware)
- Admin-only endpoints properly protected
- User endpoints require role-based permission checks
- All queries use parameterized inputs to prevent SQL injection

## Implementation Details

### Error Handling
- logAudit() includes try-catch to prevent logging failures from affecting main operations
- Connection errors are logged but don't interrupt the main application flow

### Performance
- Audit logging is asynchronous to avoid blocking request processing
- Pagination on endpoints prevents large data transfers
- Database indexes recommended on: user_email, timestamp, action, entity_type

### Database Considerations

Recommended indexes for optimal query performance:
```sql
CREATE INDEX idx_audit_user_email ON audit_logs(user_email);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
```

## Testing

To verify the audit logging system:

1. Create a new user through the admin panel
2. Request `/api/audit-logs` to see the CREATE entry
3. Request `/api/employee/{newUserId}/activities` to see user-specific activities
4. Submit a leave request and approve/reject it
5. Check logs to verify APPROVE/REJECT entries

## Future Enhancements

Potential additions:
- IP address logging for security tracking
- Browser/User-Agent logging
- Bulk export of audit logs (CSV/Excel)
- Audit log retention policies
- Real-time audit log streaming
- Webhook notifications for critical actions
- Advanced analytics dashboard

## File Changes

**Modified:** server.js
- Added audit_logs table creation (line ~192)
- Enhanced logAudit() function (line ~345)
- Added 14+ logAudit() calls throughout endpoints
- Added /api/audit-logs endpoint (line 1101)
- Added /api/employee/:userId/activities endpoint (line 1173)
