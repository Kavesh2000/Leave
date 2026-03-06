const { query } = require('./db');

async function cleanup() {
  try {
    console.log('Connected to SQL Server...\n');

    // Drop unnecessary tables
    const dropTables = [
      'audit_logs',
      'leave_request',
      'LeaveRequest'
    ];

    for (const table of dropTables) {
      try {
        await query(`DROP TABLE IF EXISTS [${table}]`);
        console.log(`✓ Dropped ${table}`);
      } catch (err) {
        console.log(`  (${table} doesn't exist or already dropped)`);
      }
    }

    console.log('\nRenaming tables...');

    // Rename tables
    try {
      await query(`EXEC sp_rename 'departments', 'department'`);
      console.log('✓ Renamed departments → department');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  (department table already exists)');
      } else {
        console.log(`  Error: ${err.message}`);
      }
    }

    try {
      await query(`EXEC sp_rename 'leave_types', 'leave_type'`);
      console.log('✓ Renamed leave_types → leave_type');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  (leave_type table already exists)');
      } else {
        console.log(`  Error: ${err.message}`);
      }
    }

    try {
      await query(`EXEC sp_rename 'user_leave_balances', 'balance'`);
      console.log('✓ Renamed user_leave_balances → balance');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  (balance table already exists)');
      } else {
        console.log(`  Error: ${err.message}`);
      }
    }

    console.log('\nCreating HOD table...');

    // Create HOD table
    await query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'hod')
      CREATE TABLE hod(
        id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT,
        department_id INT,
        is_acting BIT DEFAULT 0
      )
    `);
    console.log('✓ HOD table ready');

    console.log('\nFinal database tables:');
    const result = await query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE='BASE TABLE' 
      ORDER BY TABLE_NAME
    `);

    result.recordset.forEach(row => {
      console.log(`  → ${row.TABLE_NAME}`);
    });

    console.log('\n✓ Database cleanup complete!');
    process.exit(0);

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

cleanup();
