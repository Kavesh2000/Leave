// Script to sync all user leave balances to default_days for each leave type
const { query, initPool } = require('../db');

async function main() {
  await initPool();
  // Get all users
  const users = (await query('SELECT id FROM users')).recordset;
  // Get all leave types
  const leaveTypes = (await query('SELECT id, default_days FROM leave_type')).recordset;

  let updates = 0;
  for (const user of users) {
    for (const lt of leaveTypes) {
      await query(
        'MERGE balance AS target USING (VALUES($1,$2,$3)) AS src(user_id, leave_type_id, remaining_days) ON target.user_id = src.user_id AND target.leave_type_id = src.leave_type_id WHEN MATCHED THEN UPDATE SET remaining_days = src.remaining_days WHEN NOT MATCHED THEN INSERT(user_id, leave_type_id, remaining_days) VALUES(src.user_id, src.leave_type_id, src.remaining_days);',
        [user.id, lt.id, lt.default_days]
      );
      updates++;
      console.log('Set balance:', user.id, lt.id, lt.default_days);
    }
  }
  console.log('Done. Updated', updates, 'balances to default_days.');
}

main().catch(console.error);