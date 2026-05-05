-- ============================================
-- FIX ENUM ERRORS IN NEON POSTGRESQL
-- Lỗi: cannot cast type course_status to enum_courses_status
-- ============================================

-- Hàm helper để xóa và tạo lại enum types
-- Chạy từng phần nếu cần, hoặc chạy toàn bộ

-- ============================================
-- PHẦN 1: DROP ENUM TYPES CŨ (nếu tồn tại)
-- ============================================

-- Lưu ý: Cần đổi tên enum cũ trước khi xóa nếu có bảng đang dùng
-- Hoặc dùng CASCADE để xóa luôn cột đang dùng enum đó

-- Xóa enum courses_status nếu tồn tại
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_status' AND n.nspname = 'public') THEN
        -- Đổi tên enum cũ để tránh conflict
        ALTER TYPE "enum_courses_status" RENAME TO "enum_courses_status_old";
    END IF;
END $$;

-- Xóa các enum types khác nếu cần fix thêm
DO $$
BEGIN
    -- Course level enum
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_level' AND n.nspname = 'public') THEN
        ALTER TYPE "enum_courses_level" RENAME TO "enum_courses_level_old";
    END IF;
    
    -- Course generationStatus enum
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_generationstatus' AND n.nspname = 'public') THEN
        ALTER TYPE "enum_courses_generationstatus" RENAME TO "enum_courses_generationstatus_old";
    END IF;
    
    -- Course durationType enum
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_durationtype' AND n.nspname = 'public') THEN
        ALTER TYPE "enum_courses_durationtype" RENAME TO "enum_courses_durationtype_old";
    END IF;
    
    -- Course durationUnit enum
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_durationunit' AND n.nspname = 'public') THEN
        ALTER TYPE "enum_courses_durationunit" RENAME TO "enum_courses_durationunit_old";
    END IF;
END $$;

-- ============================================
-- PHẦN 2: TẠO ENUM TYPES MỚI (đúng tên Sequelize mong đợi)
-- ============================================

-- Enum cho courses.status
CREATE TYPE "enum_courses_status" AS ENUM ('draft', 'pending_review', 'published', 'rejected');

-- Enum cho courses.level
CREATE TYPE "enum_courses_level" AS ENUM ('beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced', 'proficiency', 'all-levels');

-- Enum cho courses.generationStatus
CREATE TYPE "enum_courses_generationstatus" AS ENUM ('draft', 'generating_outline', 'outline_ready', 'generating_content', 'completed', 'failed');

-- Enum cho courses.durationType
CREATE TYPE "enum_courses_durationtype" AS ENUM ('lifetime', 'fixed', 'subscription');

-- Enum cho courses.durationUnit
CREATE TYPE "enum_courses_durationunit" AS ENUM ('days', 'months', 'years');

-- ============================================
-- PHẦN 3: ALTER COLUMNS NẾU BẢNG ĐÃ TỒN TẠI
-- ============================================

-- Chỉ chạy nếu bảng courses đã tồn tại
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'courses' AND table_schema = 'public') THEN
        
        -- Alter status column về text trước khi set lại enum
        ALTER TABLE courses ALTER COLUMN status TYPE VARCHAR(50);
        ALTER TABLE courses ALTER COLUMN status TYPE "enum_courses_status" USING status::"enum_courses_status";
        
        -- Alter level column
        ALTER TABLE courses ALTER COLUMN level TYPE VARCHAR(50);
        ALTER TABLE courses ALTER COLUMN level TYPE "enum_courses_level" USING level::"enum_courses_level";
        
        -- Alter generationStatus column (có thể null)
        ALTER TABLE courses ALTER COLUMN "generationStatus" TYPE VARCHAR(50);
        ALTER TABLE courses ALTER COLUMN "generationStatus" TYPE "enum_courses_generationstatus" 
            USING "generationStatus"::"enum_courses_generationstatus";
        
        -- Alter durationType column (có thể null)
        ALTER TABLE courses ALTER COLUMN "durationType" TYPE VARCHAR(50);
        ALTER TABLE courses ALTER COLUMN "durationType" TYPE "enum_courses_durationtype" 
            USING "durationType"::"enum_courses_durationtype";
        
        -- Alter durationUnit column (có thể null)
        ALTER TABLE courses ALTER COLUMN "durationUnit" TYPE VARCHAR(50);
        ALTER TABLE courses ALTER COLUMN "durationUnit" TYPE "enum_courses_durationunit" 
            USING "durationUnit"::"enum_courses_durationunit";
            
    END IF;
END $$;

-- ============================================
-- PHẦN 4: XÓA ENUM CŨ (SAFELY)
-- ============================================

DO $$
BEGIN
    -- Xóa enum cũ nếu tồn tại
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_status_old' AND n.nspname = 'public') THEN
        DROP TYPE "enum_courses_status_old";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_level_old' AND n.nspname = 'public') THEN
        DROP TYPE "enum_courses_level_old";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_generationstatus_old' AND n.nspname = 'public') THEN
        DROP TYPE "enum_courses_generationstatus_old";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_durationtype_old' AND n.nspname = 'public') THEN
        DROP TYPE "enum_courses_durationtype_old";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_type t 
               JOIN pg_namespace n ON n.oid = t.typnamespace 
               WHERE t.typname = 'enum_courses_durationunit_old' AND n.nspname = 'public') THEN
        DROP TYPE "enum_courses_durationunit_old";
    END IF;
END $$;

-- ============================================
-- PHẦN 5: VERIFY KẾT QUẢ
-- ============================================

SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname LIKE 'enum_courses_%'
AND n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;
