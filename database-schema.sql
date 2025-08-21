-- Database Schema for Future Soldiers APK
-- Run this file in your PostgreSQL database

-- Users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'soldier',
    unit VARCHAR(100),
    rank VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    heading DECIMAL(5, 2),
    fcm_token TEXT,
    expo_token TEXT,
    device_type VARCHAR(20),
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zones table for geofencing
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    zone_type VARCHAR(50) NOT NULL, -- 'restricted', 'danger', 'safe', 'operation'
    center_lat DECIMAL(10, 8) NOT NULL,
    center_lng DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER NOT NULL,
    unit VARCHAR(100),
    created_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zone breach events
CREATE TABLE IF NOT EXISTS zone_breaches (
    id SERIAL PRIMARY KEY,
    zone_id INTEGER REFERENCES zones(id),
    user_id INTEGER REFERENCES users(id),
    breach_type VARCHAR(50) NOT NULL, -- 'entry', 'exit', 'unauthorized'
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    notes TEXT
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to INTEGER REFERENCES users(id),
    assigned_by INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    due_date TIMESTAMP,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'error', 'zone-breach', 'emergency', 'assignment'
    category VARCHAR(50), -- 'system', 'zone', 'assignment', 'emergency'
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    is_read BOOLEAN DEFAULT false,
    source VARCHAR(50) DEFAULT 'system', -- 'system', 'firebase', 'expo', 'manual'
    data JSONB, -- Store additional data like zone_id, assignment_id, etc.
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Alerts table for emergency situations
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'active',
    user_id INTEGER REFERENCES users(id),
    unit VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    zone_alerts BOOLEAN DEFAULT true,
    assignment_alerts BOOLEAN DEFAULT true,
    emergency_alerts BOOLEAN DEFAULT true,
    system_notifications BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '06:00:00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification delivery log
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id),
    user_id INTEGER REFERENCES users(id),
    delivery_method VARCHAR(50) NOT NULL, -- 'push', 'email', 'sms'
    delivery_status VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'failed', 'opened'
    fcm_message_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_unit ON alerts(unit);
CREATE INDEX IF NOT EXISTS idx_zone_breaches_user_id ON zone_breaches(user_id);
CREATE INDEX IF NOT EXISTS idx_zone_breaches_zone_id ON zone_breaches(zone_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notification_preferences_updated_at BEFORE UPDATE ON user_notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Notify channel for alerts insert
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_alert_insert') THEN
        CREATE OR REPLACE FUNCTION notify_alert_insert() RETURNS trigger AS $$
        DECLARE
            payload JSON;
        BEGIN
            payload := json_build_object(
                'id', NEW.id,
                'category', NEW.category,
                'message', NEW.message,
                'severity', NEW.severity,
                'status', NEW.status,
                'user_id', NEW.user_id,
                'unit', NEW.unit,
                'created_at', NEW.created_at
            );
            PERFORM pg_notify('alerts_inserted', payload::text);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'tr_alerts_notify_insert'
    ) THEN
        CREATE TRIGGER tr_alerts_notify_insert
        AFTER INSERT ON alerts
        FOR EACH ROW
        EXECUTE FUNCTION notify_alert_insert();
    END IF;
END $$;


trigger for alerts
CREATE OR REPLACE FUNCTION notify_alert_insert() RETURNS trigger AS $$
DECLARE payload JSON;
BEGIN
  payload := json_build_object(
    'id', NEW.id,'category', NEW.category,'message', NEW.message,
    'severity', NEW.severity,'status', NEW.status,'user_id', NEW.user_id,
    'unit', NEW.unit,'created_at', NEW.created_at
  );
  PERFORM pg_notify('alerts_inserted', payload::text);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER tr_alerts_notify_insert
AFTER INSERT ON alerts
FOR EACH ROW EXECUTE FUNCTION notify_alert_insert();