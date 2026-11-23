ALTER TABLE users ADD COLUMN role ENUM('admin','staff') NOT NULL DEFAULT 'staff';
UPDATE users SET role='admin' WHERE username='admin';
