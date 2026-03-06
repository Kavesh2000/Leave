Leave Management System

This project now uses a **shared SQL Server database** (`LeaveApp`) hosted at `172.16.200.45` for both the ticketing and leave applications. The helper module `db.js` contains the connection configuration and is used by all scripts.

### Setup

1. Install dependencies:

```powershell
npm install
```

2. Initialize the database (creates tables and seeds an admin):

```powershell
node init_sql_server.js
```

3. Start the leave server:

```powershell
npm start
```

4. Optionally start the gateway (listens on port 3000 and proxies to the leave app on 3001):

```powershell
node gateway.js
```

### Configuration

Environment variables may be used to override defaults in `db.js`:

| Variable       | Purpose                  | Default             |
|----------------|--------------------------|---------------------|
| `DB_SERVER`    | SQL Server host          | `172.16.200.45`     |
| `DB_USER`      | SQL Server username      | `realm`             |
| `DB_PASSWORD`  | SQL Server password      | `oohay@st!lisa`     |
| `DB_NAME`      | Database name            | `LeaveApp`          |

### Default seeded users
- admin / password (role: admin)
- hod@example.com / password (role: HOD)
- emp@example.com / password (role: employee)

Open http://localhost:3000 in your browser (or 3001 directly if bypassing the gateway).