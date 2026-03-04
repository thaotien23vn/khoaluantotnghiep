-- Create Bootstrap Admin Account
-- Run this SQL in your MySQL database before running security tests

-- Insert admin user (password: admin123)
INSERT INTO users (
    name, 
    username, 
    email, 
    passwordHash, 
    role, 
    isEmailVerified,
    createdAt,
    updatedAt
) VALUES (
    'Admin User',
    'admin',
    'admin@example.com',
    '$2b$10$rOzJqQjQjQjQjQjQjQjQuOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ',
    'admin',
    1,
    NOW(),
    NOW()
);

-- Verify the admin was created
SELECT * FROM users WHERE email = 'admin@example.com';

-- Note: The password hash above is for "admin123"
-- If you want a different password, generate it with:
-- bcrypt.hashSync('your_password', 10)
