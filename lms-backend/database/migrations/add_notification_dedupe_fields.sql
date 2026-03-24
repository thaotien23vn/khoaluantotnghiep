-- Migration: Add dedupe fields to notifications table for Smart Notifications
-- Created: 2026-03-24

-- Add dedupeKey column
ALTER TABLE notifications 
ADD COLUMN dedupe_key VARCHAR(255) NULL COMMENT 'Key for deduplication (e.g., quiz_deadline:123:24h)' 
AFTER payload;

-- Add dedupeUntil column
ALTER TABLE notifications 
ADD COLUMN dedupe_until TIMESTAMP NULL COMMENT 'Timestamp until which this dedupeKey is valid' 
AFTER dedupe_key;

-- Create unique index for deduplication
CREATE UNIQUE INDEX idx_notifications_user_dedupe 
ON notifications(userId, dedupe_key);

-- Add index for dedupeUntil for cleanup queries
CREATE INDEX idx_notifications_dedupe_until 
ON notifications(dedupe_until);
