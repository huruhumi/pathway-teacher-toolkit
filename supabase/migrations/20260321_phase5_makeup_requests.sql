-- Phase 5.2: Create makeup_requests table for tracking student leave → makeup flow
-- This is a NEW table, no existing tables are modified.
CREATE TABLE IF NOT EXISTS makeup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    resolved_session_id UUID REFERENCES class_sessions(id) ON DELETE
    SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS: teacher sees their own class makeup requests
ALTER TABLE makeup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own makeup requests" ON makeup_requests FOR ALL USING (teacher_id = auth.uid());
-- Index for fast lookup by teacher
CREATE INDEX IF NOT EXISTS idx_makeup_requests_teacher ON makeup_requests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_makeup_requests_student ON makeup_requests(student_id);