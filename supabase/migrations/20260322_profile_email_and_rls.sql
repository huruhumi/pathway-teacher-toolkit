-- ============================================================
-- Phase 0: Profile Email Column + RLS Fixes
-- 1. Add missing email column to students
-- 2. Add missing student self-update RLS policy
-- 3. Replace dangerously over-permissive anon UPDATE policy
--    with a SECURITY DEFINER function (column whitelist enforced)
-- ============================================================
-- 1. Add email column (stores the real email bound by the student)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS email text;
-- 2. Create the missing "Students update own profile" RLS policy
--    Allows authenticated student to update ONLY their own row.
--    Column-level write access is already constrained by the
--    updateStudentProfile service function's patch shape.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'students'
        AND policyname = 'Students update own profile'
) THEN EXECUTE $$ CREATE POLICY "Students update own profile" ON students FOR
UPDATE USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
$$;
END IF;
END $$;
-- 3. Drop the over-permissive public UPDATE policy (IDOR risk)
DROP POLICY IF EXISTS "Update student via invite_code" ON students;
-- Replace with a SECURITY DEFINER function that enforces a strict
-- column whitelist. Only profile intro fields can be written anon.
CREATE OR REPLACE FUNCTION public.update_student_by_invite(
        p_invite_code text,
        p_name text DEFAULT NULL,
        p_english_name text DEFAULT NULL,
        p_parent_name text DEFAULT NULL,
        p_parent_phone text DEFAULT NULL
    ) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$ BEGIN
UPDATE students
SET name = COALESCE(p_name, name),
    english_name = COALESCE(p_english_name, english_name),
    parent_name = COALESCE(p_parent_name, parent_name),
    parent_phone = COALESCE(p_parent_phone, parent_phone)
WHERE invite_code = p_invite_code
    AND invite_code IS NOT NULL
    AND invite_code <> '';
RETURN FOUND;
END;
$$;
-- Grant execute to anon so the parent form can call it without auth
GRANT EXECUTE ON FUNCTION public.update_student_by_invite TO anon;