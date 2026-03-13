-- Fix audit_logs table schema for required columns
ALTER TABLE audit_logs ADD user_email NVARCHAR(200) NULL;
ALTER TABLE audit_logs ADD action NVARCHAR(50) NULL;
ALTER TABLE audit_logs ADD entity_type NVARCHAR(50) NULL;
ALTER TABLE audit_logs ADD entity_id INT NULL;
ALTER TABLE audit_logs ADD details NVARCHAR(MAX) NULL;
ALTER TABLE audit_logs ADD timestamp DATETIME NULL;
