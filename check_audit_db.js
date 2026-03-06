// Check database tables and audit_logs setup using shared helper
const { query } = require('./db');

async function checkDatabase() {
  try {
    console.log('✓ Connected to database\n');

    // Check if audit_logs table exists
    const tableCheck = await query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='audit_logs'`
    );

    console.log(
      'Audit Logs Table:',
      tableCheck.recordset.length > 0 ? '✓ EXISTS' : '✗ DOES NOT EXIST'
    );

    if (tableCheck.recordset.length > 0) {
      const auditCount = await query(`SELECT COUNT(*) as cnt FROM audit_logs`);
      console.log('Audit Logs Count:', auditCount.recordset[0].cnt);

      const recent = await query(
        `SELECT TOP 5 * FROM audit_logs ORDER BY timestamp DESC`
      );
      console.log('\nRecent Audit Logs:');
      recent.recordset.forEach(log => {
        console.log(`  [${log.timestamp}] ${log.user_email} - ${log.action} on ${log.entity_type} #${log.entity_id}`);
      });
    }

    const userCount = await query(`SELECT COUNT(*) as cnt FROM users WHERE role='admin'`);
    console.log('\nAdmin Users:', userCount.recordset[0].cnt);

    const adminUser = await query(`SELECT TOP 1 id, email, role FROM users WHERE role='admin'`);
    if (adminUser.recordset.length > 0) {
      const u = adminUser.recordset[0];
      console.log(`  ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`);
    }

    console.log('\n✓ Database check complete');
  } catch (err) {
    console.error('✗ Database Error:', err.message);
    process.exit(1);
  }
}

checkDatabase();
