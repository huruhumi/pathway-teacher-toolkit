-- ============================================
-- Pathway Academy Toolkit — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Nature Compass: Lesson Plans
CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled',
  plan_data JSONB,
  cover_image TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Nature Compass: Curricula
CREATE TABLE IF NOT EXISTS curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled',
  curriculum_data JSONB,
  params_data JSONB,
  language TEXT DEFAULT 'en',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Essay Lab: Correction Records
CREATE TABLE IF NOT EXISTS essay_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grade TEXT,
  cefr TEXT,
  topic_text TEXT,
  essay_text TEXT,
  report_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ESL Planner: Lessons
CREATE TABLE IF NOT EXISTS esl_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled',
  level TEXT,
  description TEXT,
  content_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ESL Planner: Curricula
CREATE TABLE IF NOT EXISTS esl_curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled',
  level TEXT,
  total_lessons INTEGER,
  description TEXT,
  curriculum_data JSONB,
  params_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Enable Row Level Security
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE esl_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE esl_curricula ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: each user can only CRUD their own rows
CREATE POLICY "Users manage own data" ON lesson_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own data" ON curricula FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own data" ON essay_records FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own data" ON esl_lessons FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own data" ON esl_curricula FOR ALL USING (auth.uid() = user_id);
