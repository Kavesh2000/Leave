// Script to auto-populate missing leave balances for all users and leave types
const { query, initPool } = require('../db');

async function main() {
  await initPool();
  // Get all users
  const users = (await query('SELECT id FROM users')).recordset;
  // Get all leave types
  const leaveTypes = (await query('SELECT id, default_days FROM leave_type')).recordset;
  // Get all balances
  const balances = (await query('SELECT user_id, leave_type_id FROM balance')).recordset;
  const balanceSet = new Set(balances.map(b => `${b.user_id}-${b.leave_type_id}`));

  let inserts = 0;
  for (const user of users) {
    for (const lt of leaveTypes) {
      const key = `${user.id}-${lt.id}`;
      if (!balanceSet.has(key)) {
        await query(
          'INSERT INTO balance(user_id, leave_type_id, remaining_days) VALUES($1, $2, $3)',
          [user.id, lt.id, lt.default_days]
        );
        inserts++;
        console.log('Inserted balance:', user.id, lt.id, lt.default_days);
      }
    }
  }
  console.log('Done. Inserted', inserts, 'missing balances.');
}

main().catch(console.error);