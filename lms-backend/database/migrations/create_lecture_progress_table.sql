-- Create lecture_progress table for PostgreSQL
CREATE TABLE IF NOT EXISTS lecture_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  lecture_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  watched_percent DECIMAL(5,2) DEFAULT 0.0,
  is_completed BOOLEAN DEFAULT FALSE,
  last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  
  CONSTRAINT unique_user_lecture_progress UNIQUE (user_id, lecture_id),
  status VARCHAR(20) DEFAULT 'active',
  CONSTRAINT fk_lecture_progress_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lecture_progress_lecture_id FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
  CONSTRAINT fk_lecture_progress_course_id FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lecture_progress_user_id ON lecture_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lecture_progress_lecture_id ON lecture_progress(lecture_id);
CREATE INDEX IF NOT EXISTS idx_lecture_progress_course_id ON lecture_progress(course_id);
