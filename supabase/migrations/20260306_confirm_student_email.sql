-- Confirms a student's email after successful invite code verification.
-- This bypasses Supabase's email confirmation requirement for students,
-- since the invite code from the teacher serves as identity verification.
-- SECURITY DEFINER runs with the function owner's privileges (postgres).
CREATE OR REPLACE FUNCTION public.confirm_student_email()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only confirm if the current user's email is not yet confirmed
    UPDATE auth.users
    SET email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = auth.uid()
      AND email_confirmed_at IS NULL;
    
    RETURN FOUND;
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.confirm_student_email() TO authenticated;
-- Also allow anon (just-registered users before confirmation)
GRANT EXECUTE ON FUNCTION public.confirm_student_email() TO anon;
