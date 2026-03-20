-- Fix: the existing "Teachers see own assignments" policy has USING but no WITH CHECK,
-- which blocks INSERT in some PostgREST configurations.
DROP POLICY IF EXISTS "Teachers see own assignments" ON assignments;
CREATE POLICY "Teachers manage own assignments" ON assignments FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
-- Also fix submissions: ensure teachers can insert submissions for their assignments
DROP POLICY IF EXISTS "Teachers manage submissions" ON submissions;
CREATE POLICY "Teachers manage submissions" ON submissions FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM assignments
        WHERE assignments.id = submissions.assignment_id
            AND assignments.teacher_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM assignments
        WHERE assignments.id = submissions.assignment_id
            AND assignments.teacher_id = auth.uid()
    )
);