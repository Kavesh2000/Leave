const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err)=>{ if(err){ console.error('DB open error', err); process.exit(1);} });

const assignments = [
  {dept: 'ICT', name: 'Eric Mokaya'},
  {dept: 'Branch', name: 'Michael Mureithi'},
  {dept: 'Finance', name: 'Elizabeth Mungai'},
  {dept: 'Customer Service', name: 'Patience Mutunga'}
];

function run(){
  db.serialize(()=>{
    assignments.forEach(a=>{
      db.get('SELECT id FROM users WHERE full_name = ?', [a.name], (e,row)=>{
        if(e) return console.error('lookup error', e);
        if(!row){
          console.log(`User not found: ${a.name}`);
          return;
        }
        const uid = row.id;
        db.run('UPDATE users SET role = ?, department = ? WHERE id = ?', ['HOD', a.dept, uid], function(err){
          if(err) return console.error('update user error', err);
          db.run('INSERT OR REPLACE INTO departments(name, hod_user_id) VALUES(?,?)', [a.dept, uid], function(err2){
            if(err2) return console.error('update dept error', err2);
            console.log(`Assigned ${a.name} (id=${uid}) as HOD of ${a.dept}`);
          });
        });
      });
    });
  });
}

run();
setTimeout(()=>{
  console.log('done');
  db.close();
}, 1000);
