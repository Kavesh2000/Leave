const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err)=>{ if(err){ console.error('DB open error', err); process.exit(1);} });

function allAsync(sql, params=[]) {
  return new Promise((res, rej)=> db.all(sql, params, (e,rows)=> e? rej(e): res(rows)));
}

(async ()=>{
  try{
    const users = await allAsync('SELECT id, full_name, email, role, department FROM users ORDER BY full_name');
    const depts = await allAsync('SELECT d.id, d.name, d.hod_user_id, u.full_name as hod_name FROM departments d LEFT JOIN users u ON u.id=d.hod_user_id ORDER BY d.name');
    console.log('USERS:'); console.log(JSON.stringify(users, null, 2));
    console.log('\nDEPARTMENTS:'); console.log(JSON.stringify(depts, null, 2));
    process.exit(0);
  }catch(err){ console.error('Query error', err); process.exit(2); }
})();
