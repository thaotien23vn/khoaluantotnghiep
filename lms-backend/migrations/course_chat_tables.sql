-- ============================================================
-- COURSE CHAT MIGRATION
-- Run this SQL on Neon PostgreSQL to create Course Chat tables
-- ============================================================

-- 1. Create course_chats table
CREATE TABLE IF NOT EXISTS course_chats (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL,
    title VARCHAR(255) DEFAULT 'Course Discussion',
    is_active BOOLEAN DEFAULT TRUE,
    ai_enabled BOOLEAN DEFAULT TRUE,
    is_enabled BOOLEAN DEFAULT TRUE,
    muted_until TIMESTAMP,
    deleted_at TIMESTAMP,
    deleted_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_chats_course_id ON course_chats(course_id);
CREATE INDEX IF NOT EXISTS idx_course_chats_enabled ON course_chats(is_enabled) WHERE is_enabled = TRUE;

-- 2. Create course_messages table
CREATE TABLE IF NOT EXISTS course_messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('student', 'teacher', 'admin', 'ai')),
    content TEXT NOT NULL,
    parent_id INTEGER,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'answered', 'resolved')),
    answered_by VARCHAR(20) CHECK (answered_by IN ('ai', 'teacher', 'admin')),
    ai_confidence FLOAT,
    ai_context JSONB,
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_by INTEGER,
    deleted_at TIMESTAMP,
    is_pinned BOOLEAN DEFAULT FALSE,
    pinned_by INTEGER,
    pinned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_messages_chat_id ON course_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_course_messages_chat_created ON course_messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_course_messages_parent ON course_messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_course_messages_sender ON course_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_course_messages_status ON course_messages(status);
CREATE INDEX IF NOT EXISTS idx_course_messages_pinned ON course_messages(chat_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_course_messages_not_deleted ON course_messages(chat_id, is_deleted) WHERE is_deleted = FALSE;

-- 3. Create course_chat_participants table
CREATE TABLE IF NOT EXISTS course_chat_participants (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    last_read_at TIMESTAMP,
    last_read_message_id INTEGER,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    is_banned BOOLEAN DEFAULT FALSE,
    banned_at TIMESTAMP,
    banned_by INTEGER,
    ban_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_chat_participants_chat ON course_chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_course_chat_participants_user ON course_chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_course_chat_participants_banned ON course_chat_participants(chat_id, is_banned) WHERE is_banned = TRUE;

-- 4. Create course_chat_escalations table
CREATE TABLE IF NOT EXISTS course_chat_escalations (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'ai_failed' CHECK (status IN ('ai_failed', 'notified_teacher', 'notified_admin', 'answered')),
    ai_confidence FLOAT,
    escalation_reason VARCHAR(255),
    teacher_notified_at TIMESTAMP,
    admin_notified_at TIMESTAMP,
    answered_at TIMESTAMP,
    answered_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_chat_escalations_chat ON course_chat_escalations(chat_id);
CREATE INDEX IF NOT EXISTS idx_course_chat_escalations_message ON course_chat_escalations(message_id);
CREATE INDEX IF NOT EXISTS idx_course_chat_escalations_status ON course_chat_escalations(status);
CREATE INDEX IF NOT EXISTS idx_course_chat_escalations_pending ON course_chat_escalations(status) WHERE status IN ('ai_failed', 'notified_teacher');

-- 5. Create course_chat_analytics table
CREATE TABLE IF NOT EXISTS course_chat_analytics (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_messages INTEGER DEFAULT 0,
    student_messages INTEGER DEFAULT 0,
    teacher_messages INTEGER DEFAULT 0,
    admin_messages INTEGER DEFAULT 0,
    ai_responses INTEGER DEFAULT 0,
    unique_participants INTEGER DEFAULT 0,
    escalations INTEGER DEFAULT 0,
    resolved_questions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, date)
);

CREATE INDEX IF NOT EXISTS idx_course_chat_analytics_chat ON course_chat_analytics(chat_id);
CREATE INDEX IF NOT EXISTS idx_course_chat_analytics_date ON course_chat_analytics(date);
CREATE INDEX IF NOT EXISTS idx_course_chat_analytics_chat_date ON course_chat_analytics(chat_id, date);

-- ============================================================
-- LESSON CHAT PERMISSIONS (if not already added)
-- ============================================================

-- Add permission columns to lesson_chats if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_chats' AND column_name = 'is_enabled') THEN
        ALTER TABLE lesson_chats ADD COLUMN is_enabled BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_chats' AND column_name = 'muted_until') THEN
        ALTER TABLE lesson_chats ADD COLUMN muted_until TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_chats' AND column_name = 'deleted_at') THEN
        ALTER TABLE lesson_chats ADD COLUMN deleted_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_chats' AND column_name = 'deleted_by') THEN
        ALTER TABLE lesson_chats ADD COLUMN deleted_by INTEGER;
    END IF;
END $$;

-- Add permission columns to lesson_messages if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_messages' AND column_name = 'deleted_by') THEN
        ALTER TABLE lesson_messages ADD COLUMN deleted_by INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_messages' AND column_name = 'deleted_at') THEN
        ALTER TABLE lesson_messages ADD COLUMN deleted_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_messages' AND column_name = 'is_pinned') THEN
        ALTER TABLE lesson_messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_messages' AND column_name = 'pinned_by') THEN
        ALTER TABLE lesson_messages ADD COLUMN pinned_by INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_messages' AND column_name = 'pinned_at') THEN
        ALTER TABLE lesson_messages ADD COLUMN pinned_at TIMESTAMP;
    END IF;
END $$;

-- Add indexes for lesson_messages
CREATE INDEX IF NOT EXISTS idx_lesson_messages_pinned ON lesson_messages(chat_id, is_pinned) WHERE is_pinned = TRUE;

-- Add permission columns to chat_participants if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_participants' AND column_name = 'is_banned') THEN
        ALTER TABLE chat_participants ADD COLUMN is_banned BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_participants' AND column_name = 'banned_at') THEN
        ALTER TABLE chat_participants ADD COLUMN banned_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_participants' AND column_name = 'banned_by') THEN
        ALTER TABLE chat_participants ADD COLUMN banned_by INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_participants' AND column_name = 'ban_reason') THEN
        ALTER TABLE chat_participants ADD COLUMN ban_reason VARCHAR(255);
    END IF;
END $$;

-- Add index for banned participants
CREATE INDEX IF NOT EXISTS idx_chat_participants_banned ON chat_participants(chat_id, is_banned) WHERE is_banned = TRUE;

-- Create chat_analytics table for lesson chat if not exists
CREATE TABLE IF NOT EXISTS chat_analytics (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_messages INTEGER DEFAULT 0,
    student_messages INTEGER DEFAULT 0,
    teacher_messages INTEGER DEFAULT 0,
    admin_messages INTEGER DEFAULT 0,
    ai_responses INTEGER DEFAULT 0,
    unique_participants INTEGER DEFAULT 0,
    escalations INTEGER DEFAULT 0,
    resolved_questions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, date)
);

CREATE INDEX IF NOT EXISTS idx_chat_analytics_chat ON chat_analytics(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_date ON chat_analytics(date);

-- ============================================================
-- VERIFICATION QUERIES (Uncomment to verify after migration)
-- ============================================================

-- Check all tables created
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%chat%';

-- Check course_chats columns
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'course_chats';

-- Check course_messages columns
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'course_messages';

-- Check indexes
-- SELECT indexname, tablename FROM pg_indexes WHERE tablename LIKE '%chat%';
