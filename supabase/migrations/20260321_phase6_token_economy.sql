-- Phase 6: Token Economy & Rewards System
-- Creates TWO new tables. No existing tables modified.
-- 1. Token Events — idempotent point ledger
CREATE TABLE IF NOT EXISTS token_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (
        source_type IN (
            'attendance',
            'submission',
            'bonus',
            'redemption'
        )
    ),
    source_id TEXT NOT NULL,
    delta INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Idempotency: same student + source_type + source_id = one event only
    UNIQUE (student_id, source_type, source_id)
);
ALTER TABLE token_events ENABLE ROW LEVEL SECURITY;
-- Students can only read their own token events
CREATE POLICY "Students read own tokens" ON token_events FOR
SELECT USING (student_id = auth.uid());
-- System/EdgeFunction inserts via service role, teachers read via join
-- Teachers see token events for their students
CREATE POLICY "Teachers read student tokens" ON token_events FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM students
            WHERE students.id = token_events.student_id
                AND students.teacher_id = auth.uid()
        )
    );
-- Teachers can insert token events for their students
CREATE POLICY "Teachers insert tokens" ON token_events FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM students
            WHERE students.id = token_events.student_id
                AND students.teacher_id = auth.uid()
        )
    );
CREATE INDEX IF NOT EXISTS idx_token_events_student ON token_events(student_id);
-- 2. Rewards — shop items configured by teacher
CREATE TABLE IF NOT EXISTS rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cost_tokens INT NOT NULL DEFAULT 100,
    max_stock INT,
    -- NULL = unlimited
    max_per_student_per_month INT,
    -- NULL = unlimited
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own rewards" ON rewards FOR ALL USING (teacher_id = auth.uid());
-- Students can read active rewards (for shop display)
CREATE POLICY "Students read active rewards" ON rewards FOR
SELECT USING (is_active = true);
-- 3. Redemptions — student purchase log
CREATE TABLE IF NOT EXISTS redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tokens_spent INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own redemptions" ON redemptions FOR
SELECT USING (student_id = auth.uid());
CREATE POLICY "Teachers manage redemptions" ON redemptions FOR ALL USING (teacher_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_redemptions_student ON redemptions(student_id);