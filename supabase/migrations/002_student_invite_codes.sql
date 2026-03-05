-- ============================================================
-- Pathway Academy — Student Invite Codes Schema Update
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add invite_code column to students table (must be unique non-null)
ALTER TABLE students ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- 2. Generate a random invite code for existing students via a temporary function
CREATE OR REPLACE FUNCTION generate_random_invite_code() RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

UPDATE students SET invite_code = generate_random_invite_code() WHERE invite_code IS NULL;

-- 3. We can theoretically enforce NOT NULL now
ALTER TABLE students ALTER COLUMN invite_code SET NOT NULL;

-- 4. Create an RPC function to link a student account securely
-- This function runs with SECURITY DEFINER to bypass RLS, allowing a new authenticated user
-- to look up their invite code and update the 'auth_user_id' of that student record.
CREATE OR REPLACE FUNCTION link_student_account(code TEXT) RETURNS BOOLEAN AS $$
DECLARE
    target_student_id UUID;
BEGIN
    -- Only allow authenticated users to call this
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Find the student with the matching invite code that hasn't been claimed yet
    SELECT id INTO target_student_id
    FROM students
    WHERE invite_code = code AND auth_user_id IS NULL;

    -- If we found one, update it
    IF target_student_id IS NOT NULL THEN
        UPDATE students
        SET auth_user_id = auth.uid()
        WHERE id = target_student_id;
        
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
