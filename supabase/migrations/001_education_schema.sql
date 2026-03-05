-- ============================================================
-- Pathway Academy — Education Management Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Classes
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  max_students int default 6,
  created_at timestamptz default now()
);

alter table classes enable row level security;
create policy "Teachers see own classes" on classes for all using (auth.uid() = teacher_id);

-- 2. Students
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade,
  name text not null,
  english_name text,
  auth_user_id uuid references auth.users(id),
  avatar_url text,
  contact_info text,
  notes text,
  created_at timestamptz default now()
);

alter table students enable row level security;
create policy "Teachers see own students" on students for all using (auth.uid() = teacher_id);
create policy "Students see self" on students for select using (auth.uid() = auth_user_id);

-- 3. Class ↔ Students (M2M)
create table if not exists class_students (
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  primary key (class_id, student_id)
);

alter table class_students enable row level security;
create policy "Teachers manage class_students" on class_students for all
  using (exists (select 1 from classes where classes.id = class_id and classes.teacher_id = auth.uid()));

-- 4. Class Sessions
create table if not exists class_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  date date not null,
  start_time time,
  end_time time,
  topic text,
  lesson_kit_id text,
  source_app text,
  notes text,
  created_at timestamptz default now()
);

alter table class_sessions enable row level security;
create policy "Teachers see own sessions" on class_sessions for all using (auth.uid() = teacher_id);

-- 5. Attendance
create table if not exists attendance (
  session_id uuid references class_sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  status text default 'present' check (status in ('present', 'absent', 'late')),
  primary key (session_id, student_id)
);

alter table attendance enable row level security;
create policy "Teachers manage attendance" on attendance for all
  using (exists (select 1 from class_sessions where class_sessions.id = session_id and class_sessions.teacher_id = auth.uid()));

-- 6. Assignments
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  title text not null,
  description text,
  content_type text not null check (content_type in ('worksheet', 'companion', 'custom')),
  content_data jsonb,
  source_app text,
  source_lesson_id text,
  due_date date,
  created_at timestamptz default now()
);

alter table assignments enable row level security;
create policy "Teachers see own assignments" on assignments for all using (auth.uid() = teacher_id);
create policy "Students see assigned" on assignments for select
  using (exists (select 1 from submissions where submissions.assignment_id = id and submissions.student_id in (select s.id from students s where s.auth_user_id = auth.uid())));

-- 7. Submissions
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'submitted', 'completed', 'returned')),
  submitted_at timestamptz,
  completed_at timestamptz,
  teacher_notes text,
  unique (assignment_id, student_id)
);

alter table submissions enable row level security;
create policy "Teachers manage submissions" on submissions for all
  using (exists (select 1 from assignments where assignments.id = assignment_id and assignments.teacher_id = auth.uid()));
create policy "Students see own submissions" on submissions for select
  using (student_id in (select s.id from students s where s.auth_user_id = auth.uid()));
create policy "Students update own submissions" on submissions for update
  using (student_id in (select s.id from students s where s.auth_user_id = auth.uid()));

-- 8. Book Loans
create table if not exists book_loans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  book_title text not null,
  isbn text,
  borrowed_at date default current_date,
  due_date date,
  returned_at date,
  notes text
);

alter table book_loans enable row level security;
create policy "Teachers see own loans" on book_loans for all using (auth.uid() = teacher_id);
