-- Fix 2: Add content column to submissions table
-- Without this column, all student answers are silently discarded by Supabase
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS content jsonb;
-- Fix 5: Add WITH CHECK clause to student update policy
-- Without this, students could change student_id to hijack other submissions
DROP POLICY IF EXISTS "Students update own submissions" ON submissions;
CREATE POLICY "Students update own submissions" ON submissions FOR
UPDATE USING (
        student_id IN (
            SELECT s.id
            FROM students s
            WHERE s.auth_user_id = auth.uid()
        )
    ) WITH CHECK (
        student_id IN (
            SELECT s.id
            FROM students s
            WHERE s.auth_user_id = auth.uid()
        )
    );