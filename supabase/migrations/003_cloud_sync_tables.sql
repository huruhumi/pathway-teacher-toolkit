-- ============================================================
-- Cloud Sync Tables for ESL Planner & Nature Compass
-- These tables support the useProjectCRUD cloud sync mechanism
-- ============================================================
-- 1. ESL Planner — Saved Lesson Kits
create table if not exists esl_lessons (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text,
    level text,
    description text,
    content_data jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table esl_lessons enable row level security;
create policy "Users manage own esl_lessons" on esl_lessons for all using (auth.uid() = user_id);
-- 2. ESL Planner — Saved Curricula
create table if not exists esl_curricula (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text,
    level text,
    total_lessons int,
    description text,
    curriculum_data jsonb,
    params_data jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table esl_curricula enable row level security;
create policy "Users manage own esl_curricula" on esl_curricula for all using (auth.uid() = user_id);
-- 3. Nature Compass — Saved Lesson Plans
create table if not exists lesson_plans (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text,
    description text,
    content_data jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table lesson_plans enable row level security;
create policy "Users manage own lesson_plans" on lesson_plans for all using (auth.uid() = user_id);
-- 4. Nature Compass — Saved Curricula
create table if not exists curricula (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text,
    description text,
    content_data jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table curricula enable row level security;
create policy "Users manage own curricula" on curricula for all using (auth.uid() = user_id);