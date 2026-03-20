-- Fix infinite recursion between assignments and submissions RLS policies.
-- The cycle: assignments."Students see assigned" queries submissions,
-- submissions."Teachers manage submissions" queries assignments → infinite loop.
-- Solution: Use SECURITY DEFINER helper functions to break the cycle.
CREATE OR REPLACE FUNCTION is_teacher_of_assignment(aid uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
SELECT EXISTS (
        SELECT 1
        FROM assignments
        WHERE id = aid
            AND teacher_id = auth.uid()
    );
$$;
CREATE OR REPLACE FUNCTION student_has_assignment(aid uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
SELECT EXISTS (
        SELECT 1
        FROM submissions s
            JOIN students st ON st.id = s.student_id
        WHERE s.assignment_id = aid
            AND st.auth_user_id = auth.uid()
    );
$$;
DROP POLICY IF EXISTS "Students see assigned" ON assignments;
CREATE POLICY "Students see assigned" ON assignments FOR
SELECT USING (student_has_assignment(id));
DROP POLICY IF EXISTS "Teachers manage submissions" ON submissions;
CREATE POLICY "Teachers manage submissions" ON submissions FOR ALL USING (is_teacher_of_assignment(assignment_id)) WITH CHECK (is_teacher_of_assignment(assignment_id));