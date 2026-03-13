-- Set correct HOD emails for Michael Mureithi and Patience Mutunga
UPDATE department SET hod_email = 'michael.mureithi@maishabank.com' WHERE name = 'Branch';
UPDATE department SET hod_email = 'patience.mutunga@maishabank.com' WHERE name = 'Debt Collection';
