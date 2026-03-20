-- Fix: RLS infinite recursion between classes ↔ class_students
-- Root cause: student policies on classes query class_students,
-- which has a teacher policy that queries classes → infinite loop.
-- Solution: use SECURITY DEFINER functions to bypass RLS in sub-queries.
-- Step 1: Create helper function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_student_class_ids() RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER
SET search_path = public STABLE AS $$
SELECT cs.class_id
FROM class_students cs
    JOIN students s ON s.id = cs.student_id
WHERE s.auth_user_id = auth.uid();
$$;
-- Step 2: Drop broken policies
DROP POLICY IF EXISTS "Students see own classes" ON classes;
DROP POLICY IF EXISTS "Students see own class memberships" ON class_students;
DROP POLICY IF EXISTS "Students see own class sessions" ON class_sessions;
-- Step 3: Recreate using the helper function (no cross-table RLS triggers)
CREATE POLICY "Students see own classes" ON classes FOR
SELECT USING (
        id IN (
            SELECT get_student_class_ids()
        )
    );
CREATE POLICY "Students see own class memberships" ON class_students FOR
SELECT USING (
        student_id IN (
            SELECT s.id
            FROM students s
            WHERE s.auth_user_id = auth.uid()
        )
    );
CREATE POLICY "Students see own class sessions" ON class_sessions FOR
SELECT USING (
        class_id IN (
            SELECT get_student_class_ids()
        )
    );