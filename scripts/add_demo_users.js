const { query, initPool } = require('../db');
const bcrypt = require('bcryptjs');

const users = [
  // ICT
  { full_name: 'Stevaniah Kavela', email: 'stevaniah.kavela@company.com', role: 'employee', department: 'ICT' },
  { full_name: 'Mercy Mukhwana', email: 'mercy.mukhwana@company.com', role: 'employee', department: 'ICT' },
  { full_name: 'Eric Mokaya', email: 'eric.mokaya@company.com', role: 'HOD', department: 'ICT' },
  // Branch
  { full_name: 'Caroline Ngugi', email: 'caroline.ngugi@company.com', role: 'employee', department: 'Branch' },
  { full_name: 'Lilian Kimani', email: 'lilian.kimani@company.com', role: 'employee', department: 'Branch' },
  { full_name: 'Maureen Kerubo', email: 'maureen.kerubo@company.com', role: 'employee', department: 'Branch' },
  { full_name: 'Alice Muthoni', email: 'alice.muthoni@company.com', role: 'employee', department: 'Branch' },
  { full_name: 'Michael Mureithi', email: 'michael.mureithi@company.com', role: 'HOD', department: 'Branch' },
  // Finance
  { full_name: 'Patrick Ndegwa', email: 'patrick.ndegwa@company.com', role: 'employee', department: 'Finance' },
  { full_name: 'Margaret Njeri', email: 'margaret.njeri@company.com', role: 'employee', department: 'Finance' },
  { full_name: 'Elizabeth Mungai', email: 'elizabeth.mungai@company.com', role: 'HOD', department: 'Finance' },
  // Customer Service
  { full_name: 'Juliana Jeptoo', email: 'juliana.jeptoo@company.com', role: 'employee', department: 'Customer Service' },
  { full_name: 'Faith Bonareri', email: 'faith.bonareri@company.com', role: 'employee', department: 'Customer Service' },
  { full_name: 'Patience Mutunga', email: 'patience.mutunga@company.com', role: 'HOD', department: 'Customer Service' },
  { full_name: 'Eva Mukami', email: 'eva.mukami@company.com', role: 'employee', department: 'Customer Service' },
  { full_name: 'Peter Kariuki', email: 'peter.kariuki@company.com', role: 'employee', department: 'Customer Service' }
];

function generateUsername(email, name) {
  if (email) return email.split('@')[0];
  if (name) return name.toLowerCase().replace(/[^a-z]/g, '');
  return 'user' + Math.floor(Math.random() * 10000);
}

async function addUsers() {
  try {
    await initPool();
    const password = bcrypt.hashSync('1234', 10);
    for (const user of users) {
      const username = generateUsername(user.email, user.full_name);
      await query(
        `INSERT INTO dbo.users (username, full_name, email, password, password_hash, role, department) VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6);`,
        [username, user.full_name, user.email, password, password, user.role, user.department]
      );
      console.log('Inserted user:', user.full_name, '| Username:', username);
    }
    console.log('All users inserted.');
  } catch (err) {
    console.error('Error inserting users:', err);
  }
}

if (require.main === module) {
  addUsers();
}
