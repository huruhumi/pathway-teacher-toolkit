-- Expand allowed content types for assignments
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_content_type_check;
ALTER TABLE assignments
ADD CONSTRAINT assignments_content_type_check CHECK (
        content_type IN (
            'worksheet',
            'companion',
            'custom',
            'assignment_sheet'
        )
    );
-- Expand allowed statuses for submissions
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions
ADD CONSTRAINT submissions_status_check CHECK (
        status IN (
            'pending',
            'submitted',
            'completed',
            'returned',
            'incomplete'
        )
    );
-- Add points to students table safely
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'students'
        AND column_name = 'points_balance'
) THEN
ALTER TABLE students
ADD COLUMN points_balance int not null default 0;
END IF;
END $$;
-- Add points earned to submissions safely
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'submissions'
        AND column_name = 'points_earned'
) THEN
ALTER TABLE submissions
ADD COLUMN points_earned int not null default 0;
END IF;
END $$;
-- Create secure RPC for awarding gamification points
CREATE OR REPLACE FUNCTION edu_award_points(sub_id uuid, points_to_add int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $func$
DECLARE v_student_id uuid;
v_current_earned int;
v_status text;
BEGIN -- Verify the submission exists and get info
SELECT student_id,
    COALESCE(points_earned, 0),
    status INTO v_student_id,
    v_current_earned,
    v_status
FROM submissions
WHERE id = sub_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Submission % not found',
sub_id;
END IF;
-- Security Check: Call must be from the student or the teacher who owns the assignment
IF NOT EXISTS (
    SELECT 1
    FROM students s
    WHERE s.id = v_student_id
        AND s.auth_user_id = auth.uid()
)
AND NOT EXISTS (
    SELECT 1
    FROM assignments a
        JOIN submissions sub ON a.id = sub.assignment_id
    WHERE sub.id = sub_id
        AND a.teacher_id = auth.uid()
) THEN RAISE EXCEPTION 'Not authorized to award points for this submission';
END IF;
-- Update submission points
UPDATE submissions
SET points_earned = points_to_add
WHERE id = sub_id;
-- Update student cumulative balance with the delta
UPDATE students
SET points_balance = points_balance + (points_to_add - v_current_earned)
WHERE id = v_student_id;
END;
$func$;