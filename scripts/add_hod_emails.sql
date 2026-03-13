-- Add hod_email and acting_hod_email columns to department table
ALTER TABLE department ADD hod_email NVARCHAR(200) NULL;
ALTER TABLE department ADD acting_hod_email NVARCHAR(200) NULL;

-- Example: Set HOD and acting HOD emails for each department
UPDATE department SET hod_email = 'eric.mokaya@maishabank.com' WHERE name = 'ICT';
UPDATE department SET hod_email = 'elizabeth.mungai@maishabank.com' WHERE name = 'Finance';
UPDATE department SET hod_email = 'alice.muthoni@maishabank.com' WHERE name = 'Branch';
UPDATE department SET hod_email = 'eva.mukami@maishabank.com' WHERE name = 'Debt Collection';

-- To give Elizabeth Mungai acting HOD rights everywhere:
UPDATE department SET acting_hod_email = 'elizabeth.mungai@maishabank.com';
