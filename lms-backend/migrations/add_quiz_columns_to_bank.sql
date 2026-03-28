-- Migration: Add columns to placement_question_bank for quiz integration
-- Run this on Neon PostgreSQL

-- 1. Add new columns (nullable to avoid affecting existing data)
-- Note: PostgreSQL doesn't support UNSIGNED, use CHECK constraint or just INTEGER
ALTER TABLE placement_question_bank 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'placement',
ADD COLUMN IF NOT EXISTS course_id INTEGER CHECK (course_id > 0),
ADD COLUMN IF NOT EXISTS lecture_id INTEGER CHECK (lecture_id > 0);

-- 2. Add comment for documentation
COMMENT ON COLUMN placement_question_bank.source_type IS 'placement or quiz';
COMMENT ON COLUMN placement_question_bank.course_id IS 'Course ID for quiz source type';
COMMENT ON COLUMN placement_question_bank.lecture_id IS 'Lecture ID for quiz source type';

-- 3. Update existing rows to have source_type = 'placement'
UPDATE placement_question_bank 
SET source_type = 'placement' 
WHERE source_type IS NULL;

-- 4. Make source_type NOT NULL after backfill
ALTER TABLE placement_question_bank 
ALTER COLUMN source_type SET NOT NULL;

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_placement_bank_source_type ON placement_question_bank(source_type);
CREATE INDEX IF NOT EXISTS idx_placement_bank_course_id ON placement_question_bank(course_id);
CREATE INDEX IF NOT EXISTS idx_placement_bank_lecture_id ON placement_question_bank(lecture_id);

-- 6. Note: For adding 'true_false' to enum, we need to create new enum type
-- Since PostgreSQL doesn't allow ALTER TYPE ADD VALUE in transaction blocks
-- We'll handle this in application layer by mapping true_false to multiple_choice
