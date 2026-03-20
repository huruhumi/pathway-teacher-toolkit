-- Fix infinite recursion in assignments/submissions RLS.
-- Root cause: assignments had "Students see assigned" policy that queried submissions,
-- and submissions had "Teachers manage submissions" that queried assignments → cycle.
-- Solution: Remove all student-facing policies from assignments table.
-- Students access assignment data through the submissions table join instead.
-- 1. Drop ALL problematic policies
DROP POLICY IF EXISTS "Students see class assignments" ON assignments;
DROP POLICY IF EXISTS "Students see assigned" ON assignments;
DROP POLICY IF EXISTS "Teachers manage own assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers see own assignments" ON assignments;
-- 2. Single clean teacher policy with both USING and WITH CHECK
CREATE POLICY "Teachers manage own assignments" ON assignments FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
-- 3. SECURITY DEFINER function for student portal to fetch assignments
CREATE OR REPLACE FUNCTION get_student_assignments(p_student_id uuid) RETURNS SETOF assignments LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
SELECT a.*
FROM assignments a
    JOIN submissions sub ON sub.assignment_id = a.id
WHERE sub.student_id = p_student_id;
$$;
-- 4. SECURITY DEFINER helpers (kept from earlier migration)
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
-- 5. Reload PostgREST schema cache
NOTIFY pgrst,
'reload schema';
NOTIFY pgrst,
'reload config';