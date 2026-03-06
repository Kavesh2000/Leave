-- Clean up database: drop unnecessary tables
DROP TABLE IF EXISTS [audit_logs];
DROP TABLE IF EXISTS [leave_request];
DROP TABLE IF EXISTS [LeaveRequest];
GO

-- Rename tables to clean names
EXEC sp_rename 'departments', 'department';
GO

EXEC sp_rename 'leave_types', 'leave_type';
GO

EXEC sp_rename 'user_leave_balances', 'balance';
GO

-- Create HOD table
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'hod')
CREATE TABLE hod(
    id INT PRIMARY KEY IDENTITY(1,1),
    user_id INT,
    department_id INT,
    is_acting BIT DEFAULT 0
);
GO

-- Verify final tables
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE='BASE TABLE' 
ORDER BY TABLE_NAME;
