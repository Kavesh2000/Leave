-- Ensure all required columns exist in audit_logs table (add if missing)
IF COL_LENGTH('audit_logs', 'user_email') IS NULL
  ALTER TABLE audit_logs ADD user_email NVARCHAR(200) NULL;
IF COL_LENGTH('audit_logs', 'action') IS NULL
  ALTER TABLE audit_logs ADD action NVARCHAR(50) NULL;
IF COL_LENGTH('audit_logs', 'entity_type') IS NULL
  ALTER TABLE audit_logs ADD entity_type NVARCHAR(50) NULL;
IF COL_LENGTH('audit_logs', 'entity_id') IS NULL
  ALTER TABLE audit_logs ADD entity_id INT NULL;
IF COL_LENGTH('audit_logs', 'details') IS NULL
  ALTER TABLE audit_logs ADD details NVARCHAR(MAX) NULL;
IF COL_LENGTH('audit_logs', 'timestamp') IS NULL
  ALTER TABLE audit_logs ADD timestamp DATETIME NULL;
