-- Extend students table with comprehensive profile fields
ALTER TABLE students
ADD COLUMN IF NOT EXISTS date_of_birth date,
    ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other')),
    ADD COLUMN IF NOT EXISTS level text,
    ADD COLUMN IF NOT EXISTS enrolled_at date DEFAULT current_date,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (
        status IN ('active', 'paused', 'graduated', 'withdrawn')
    ),
    ADD COLUMN IF NOT EXISTS parent_name text,
    ADD COLUMN IF NOT EXISTS parent_wechat text,
    ADD COLUMN IF NOT EXISTS parent_phone text,
    ADD COLUMN IF NOT EXISTS health_notes text,
    ADD COLUMN IF NOT EXISTS learning_notes text,
    ADD COLUMN IF NOT EXISTS proficiency text CHECK (
        proficiency IN (
            'beginner',
            'elementary',
            'intermediate',
            'advanced'
        )
    ),
    ADD COLUMN IF NOT EXISTS interests jsonb DEFAULT '[]'::jsonb;
-- Allow public reads by invite_code (for parent form Edge Function)
CREATE POLICY "Public read by invite_code" ON students FOR
SELECT USING (
        invite_code IS NOT NULL
        AND invite_code != ''
    );