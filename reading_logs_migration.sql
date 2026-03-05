-- ============================================
-- Pathway Academy Toolkit — Reading Logs Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS reading_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    book_title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    pages_read INTEGER NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'reviewed'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE reading_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Students can read their own logs and insert new ones
CREATE POLICY "Students can view own reading logs" ON reading_logs
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own reading logs" ON reading_logs
    FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Teachers can view and update reading logs assigned to them
CREATE POLICY "Teachers can view assigned reading logs" ON reading_logs
    FOR SELECT USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update assigned reading logs" ON reading_logs
    FOR UPDATE USING (auth.uid() = teacher_id);

-- Also allow teachers to delete if needed
CREATE POLICY "Teachers can delete assigned reading logs" ON reading_logs
    FOR DELETE USING (auth.uid() = teacher_id);
