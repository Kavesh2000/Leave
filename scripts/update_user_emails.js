const { query, initPool } = require('../db');

const users = [
  { full_name: 'Stevaniah Kavela' },
  { full_name: 'Mercy Mukhwana' },
  { full_name: 'Eric Mokaya' },
  { full_name: 'Caroline Ngugi' },
  { full_name: 'Lilian Kimani' },
  { full_name: 'Maureen Kerubo' },
  { full_name: 'Alice Muthoni' },
  { full_name: 'Michael Mureithi' },
  { full_name: 'Patrick Ndegwa' },
  { full_name: 'Margaret Njeri' },
  { full_name: 'Elizabeth Mungai' },
  { full_name: 'Juliana Jeptoo' },
  { full_name: 'Faith Bonareri' },
  { full_name: 'Patience Mutunga' },
  { full_name: 'Eva Mukami' },
  { full_name: 'Peter Kariuki' }
];

async function updateEmails() {
  try {
    await initPool();
    for (const user of users) {
      const email = user.full_name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ +/g, '.').replace(/\.+/g, '.') + '@maishabank.com';
      await query(
        `UPDATE users SET email = @p0 WHERE full_name = @p1`,
        [email, user.full_name]
      );
      console.log('Updated email for:', user.full_name, '->', email);
    }
    console.log('All emails updated.');
  } catch (err) {
    console.error('Error updating emails:', err);
  }
}

if (require.main === module) {
  updateEmails();
}
