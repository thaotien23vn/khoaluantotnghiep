-- Forum Topics Table
CREATE TABLE forum_topics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('global', 'course', 'lecture') NOT NULL DEFAULT 'global',
  course_id INT UNSIGNED NULL,
  lecture_id INT UNSIGNED NULL,
  user_id INT UNSIGNED NOT NULL,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  post_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_type_created (type, created_at),
  INDEX idx_course_id (course_id),
  INDEX idx_lecture_id (lecture_id),
  INDEX idx_user_id (user_id),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

-- Forum Posts Table
CREATE TABLE forum_posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  parent_id INT UNSIGNED NULL,
  is_solution BOOLEAN NOT NULL DEFAULT FALSE,
  likes INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_topic_created (topic_id, created_at),
  INDEX idx_user_id (user_id),
  INDEX idx_parent_id (parent_id),
  
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES forum_posts(id) ON DELETE CASCADE
);

-- Forum Reports Table
CREATE TABLE forum_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NULL,
  post_id INT UNSIGNED NULL,
  reporter_id INT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status_created (status, created_at),
  INDEX idx_reporter_id (reporter_id),
  INDEX idx_topic_id (topic_id),
  INDEX idx_post_id (post_id),
  
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
);
