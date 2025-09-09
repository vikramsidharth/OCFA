-- Migration script to update users table to match backend expectations
-- Run this script to add missing columns to the existing users table

-- Add missing columns to users table (if they don't exist)
DO $$ 
BEGIN
    -- Add name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name') THEN
        ALTER TABLE users ADD COLUMN name VARCHAR(100);
    END IF;
    
    -- Add category column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'category') THEN
        ALTER TABLE users ADD COLUMN category VARCHAR(50);
    END IF;
    
    -- Add MobileNumber column (with quotes for case sensitivity)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'MobileNumber') THEN
        ALTER TABLE users ADD COLUMN "MobileNumber" VARCHAR(20);
    END IF;
    
    -- Add EmployeeID column (with quotes for case sensitivity)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'EmployeeID') THEN
        ALTER TABLE users ADD COLUMN "EmployeeID" VARCHAR(50);
    END IF;
    
    -- Add age column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'age') THEN
        ALTER TABLE users ADD COLUMN age INTEGER;
    END IF;
    
    -- Add gender column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gender') THEN
        ALTER TABLE users ADD COLUMN gender VARCHAR(20);
    END IF;
    
    -- Add height column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'height') THEN
        ALTER TABLE users ADD COLUMN height VARCHAR(10);
    END IF;
    
    -- Add weight column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'weight') THEN
        ALTER TABLE users ADD COLUMN weight VARCHAR(10);
    END IF;
    
    -- Add bp column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bp') THEN
        ALTER TABLE users ADD COLUMN bp VARCHAR(20);
    END IF;
    
    -- Add blood_group column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'blood_group') THEN
        ALTER TABLE users ADD COLUMN blood_group VARCHAR(10);
    END IF;
    
    -- Rename password_hash to password if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users RENAME COLUMN password_hash TO password;
    END IF;
    
    -- Make email nullable if it's currently NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email' AND is_nullable = 'NO') THEN
        ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    END IF;
    
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_unit ON users(unit);

-- Add comments to document the table structure
COMMENT ON TABLE users IS 'Users table for the Future Soldiers APK application';
COMMENT ON COLUMN users.username IS 'Unique username for login';
COMMENT ON COLUMN users.email IS 'User email address (nullable)';
COMMENT ON COLUMN users.password IS 'Hashed password';
COMMENT ON COLUMN users.name IS 'Full name of the user';
COMMENT ON COLUMN users.role IS 'User role (commander, soldier, etc.)';
COMMENT ON COLUMN users.unit IS 'Military unit assignment';
COMMENT ON COLUMN users.category IS 'User category/division';
COMMENT ON COLUMN users."MobileNumber" IS 'Mobile phone number';
COMMENT ON COLUMN users."EmployeeID" IS 'Employee/Service ID number';
COMMENT ON COLUMN users.age IS 'User age';
COMMENT ON COLUMN users.gender IS 'User gender';
COMMENT ON COLUMN users.height IS 'User height';
COMMENT ON COLUMN users.weight IS 'User weight';
COMMENT ON COLUMN users.bp IS 'Blood pressure';
COMMENT ON COLUMN users.blood_group IS 'Blood group';
COMMENT ON COLUMN users.latitude IS 'Current latitude position';
COMMENT ON COLUMN users.longitude IS 'Current longitude position';
COMMENT ON COLUMN users.heading IS 'Current heading/direction';
