// Script to add all users as specified
const db = require('../db');
const bcrypt = require('bcryptjs');

async function main() {
  const hash = bcrypt.hashSync('1234', 10);
  const users = [
    // ICT
    ['Stevaniah Kavela', 'stevaniah.kavela@maishabank.com', hash, 'employee', 'ICT', 'female'],
    ['Mercy Mukhwana', 'mercy.mukhwana@maishabank.com', hash, 'employee', 'ICT', 'female'],
    ['Eric Mokaya', 'eric.mokaya@maishabank.com', hash, 'hod', 'ICT', 'male'],
    // Operations
    ['Caroline Ngugi', 'caroline.ngugi@maishabank.com', hash, 'employee', 'Operations', 'female'],
    ['Lilian Kimani', 'lilian.kimani@maishabank.com', hash, 'employee', 'Operations', 'female'],
    ['Maureen Kerubo', 'maureen.kerubo@maishabank.com', hash, 'employee', 'Operations', 'female'],
    ['Alice Muthoni', 'alice.muthoni@maishabank.com', hash, 'employee', 'Operations', 'female'],
    ['Michael Mureithi', 'michael.mureithi@maishabank.com', hash, 'employee', 'Operations', 'male'],
    // Finance
    ['Patrick Ndegwa', 'patrick.ndegwa@maishabank.com', hash, 'employee', 'Finance', 'male'],
    ['Margaret Njeri', 'margaret.njeri@maishabank.com', hash, 'employee', 'Finance', 'female'],
    ['Elizabeth Mungai', 'elizabeth.mungai@maishabank.com', hash, 'HR', 'HR', 'female'],
    // Debt collection
    ['Juliana Jeptoo', 'juliana.jeptoo@maishabank.com', hash, 'employee', 'Debt collection', 'female'],
    ['Faith Bonareri', 'faith.bonareri@maishabank.com', hash, 'employee', 'Debt collection', 'female'],
    ['Patience Mutunga', 'patience.mutunga@maishabank.com', hash, 'employee', 'Debt collection', 'female'],
    ['Eva Mukami', 'eva.mukami@maishabank.com', hash, 'employee', 'Debt collection', 'female'],
    ['Peter Kariuki', 'peter.kariuki@maishabank.com', hash, 'employee', 'Debt collection', 'male'],
    // Legal
    ['Clive Odame', 'clive.odame@maishabank.com', hash, 'hod', 'Legal', 'male'],
    // Security
    ['Bonface Kioko', 'bonface.kioko@maishabank.com', hash, 'hod', 'Security', 'male']
  ];
  for (const u of users) {
    await db.query("INSERT INTO users (full_name, email, password_hash, role, department, gender) VALUES (@p0, @p1, @p2, @p3, @p4, @p5)", u);
  }
  console.log('All users added. Passwords set to 1234.');
}

main().catch(console.error);