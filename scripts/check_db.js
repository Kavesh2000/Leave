// simple script to verify a connection to Postgres via DATABASE_URL
// and exercise a couple of queries.

// basic connection check using shared db.js helper
const { query, initPool } = require('../db');

(async () => {
  try {
    await initPool();
    // verify connection
    const r = await query('SELECT SYSUTCDATETIME() as now');
    console.log('connected, server time', r.recordset[0].now);

    // list users (if table exists)
    const users = await query(
      `SELECT ID, full_name, email, role, department
       FROM users ORDER BY full_name OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`);
    console.log('users:', users.recordset);

<<<<<<< HEAD
    // list departments
    const depts = await query(
      `SELECT id, name, hod_user_id FROM department ORDER BY name OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`);
=======
    // list departments with HOD emails
    const depts = await query(
      `SELECT id, name, hod_user_id, hod_email, acting_hod_email FROM department ORDER BY name OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`);
>>>>>>> d03d514 (Initial push: leave management system)
    console.log('departments:', depts.recordset);

    process.exit(0);
  } catch (err) {
    console.error('DB query error', err.message || err);
    process.exit(1);
  }
})();
