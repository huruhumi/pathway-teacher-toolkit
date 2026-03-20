-- Allow anonymous users to update student records via invite_code
-- This enables the parent form to write data without authentication
CREATE POLICY "Update student via invite_code" ON students FOR
UPDATE USING (
        invite_code IS NOT NULL
        AND invite_code != ''
    ) WITH CHECK (
        invite_code IS NOT NULL
        AND invite_code != ''
    );