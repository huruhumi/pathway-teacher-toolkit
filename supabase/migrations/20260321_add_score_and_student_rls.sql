-- Feature 1: Add score column to submissions
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS score smallint;
-- Feature 3: Student-facing SELECT RLS for schedule view
-- 1. Students can see classes they belong to (needed for join)
CREATE POLICY "Students see own classes" ON classes FOR
SELECT USING (
        id IN (
            SELECT class_id
            FROM class_students
            WHERE student_id IN (
                    SELECT s.id
                    FROM students s
                    WHERE s.auth_user_id = auth.uid()
                )
        )
    );
-- 2. Students can see their class memberships
CREATE POLICY "Students see own class memberships" ON class_students FOR
SELECT USING (
        student_id IN (
            SELECT s.id
            FROM students s
            WHERE s.auth_user_id = auth.uid()
        )
    );
-- 3. Students can see sessions for their classes
CREATE POLICY "Students see own class sessions" ON class_sessions FOR
SELECT USING (
        class_id IN (
            SELECT class_id
            FROM class_students
            WHERE student_id IN (
                    SELECT s.id
                    FROM students s
                    WHERE s.auth_user_id = auth.uid()
                )
        )
    );