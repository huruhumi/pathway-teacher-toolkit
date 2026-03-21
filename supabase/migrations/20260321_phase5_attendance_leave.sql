-- Phase 5: Extend attendance status to support 'leave' (请假)
-- This is an ADDITIVE change: only adds a new valid value, existing data is untouched.
-- The old CHECK only allows: 'present', 'absent', 'late'
-- We DROP the old constraint and ADD a new one that includes 'leave'.
-- Step 1: Drop old CHECK constraint on attendance.status
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
-- Step 2: Add new CHECK constraint that includes 'leave'
ALTER TABLE attendance
ADD CONSTRAINT attendance_status_check CHECK (status IN ('present', 'absent', 'late', 'leave'));