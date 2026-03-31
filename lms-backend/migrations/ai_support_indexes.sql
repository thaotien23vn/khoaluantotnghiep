-- Migration: Add indexes for AI Support 24/7 RAG performance
-- Created: 2024

-- ==========================================
-- AI Support 24/7 Performance Indexes
-- ==========================================

-- Index for AiChunk courseId lookups (used in unified knowledge base search)
CREATE INDEX IF NOT EXISTS idx_ai_chunks_course_id ON ai_chunks(course_id);

-- Index for AiChunk lectureId lookups
CREATE INDEX IF NOT EXISTS idx_ai_chunks_lecture_id ON ai_chunks(lecture_id);

-- Index for AiChunk combined query (course + lecture)
CREATE INDEX IF NOT EXISTS idx_ai_chunks_course_lecture ON ai_chunks(course_id, lecture_id);

-- Index for AiConversation role and user lookups (support chat)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_role ON ai_conversations(user_id, role);

-- Index for AiConversation support chats specifically
CREATE INDEX IF NOT EXISTS idx_ai_conversations_support ON ai_conversations(user_id, role, created_at) 
WHERE role = 'support';

-- Index for AiMessage conversation lookups
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);

-- Index for PlacementSession user lookups
CREATE INDEX IF NOT EXISTS idx_placement_sessions_user_status ON placement_sessions(user_id, status, completed_at);

-- Index for Enrollment user lookups
CREATE INDEX IF NOT EXISTS idx_enrollments_user_status ON enrollments(user_id, status);

-- ==========================================
-- AI Support Analytics Table (Optional)
-- ==========================================

-- Table to track AI Support 24/7 usage analytics
CREATE TABLE IF NOT EXISTS ai_support_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNSIGNED NOT NULL,
    conversation_id INTEGER UNSIGNED NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'message_sent', 'course_recommended', 'quiz_suggested', 'action_triggered'
    event_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
);

-- ==========================================
-- AI Support Quick Actions Log
-- ==========================================

-- Table to track quick action usage
CREATE TABLE IF NOT EXISTS ai_support_action_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNSIGNED NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'find_courses', 'start_placement', 'practice_quiz', etc.
    action_result VARCHAR(50), -- 'success', 'failed', 'redirected'
    context_page VARCHAR(255), -- current page when action triggered
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at)
);
