-- Update department HOD assignments to match actual user IDs
-- Finance: set to Elizabeth Mungai (ID 13)
UPDATE department SET hod_user_id = 13 WHERE name = 'Finance';
-- ICT: set to Eric Mokaya (ID 5)
UPDATE department SET hod_user_id = 5 WHERE name = 'ICT';
-- Branch: (set to a valid HOD user ID if needed, e.g., 9 for Alice Muthoni)
-- UPDATE department SET hod_user_id = 9 WHERE name = 'Branch';
++ Debt Collection: (set to a valid HOD user ID if needed, e.g., 17 for Eva Mukami)
++ UPDATE department SET hod_user_id = 17 WHERE name = 'Debt Collection';
