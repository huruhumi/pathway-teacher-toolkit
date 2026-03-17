-- ============================================================
-- Teacher review calibration fields + profile table
-- ============================================================

alter table if exists teacher_reviews
    add column if not exists model_score numeric,
    add column if not exists textbook_level_key text;

create table if not exists esl_scoring_calibration (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    textbook_level_key text not null,
    sample_count int not null default 0,
    avg_delta numeric not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, textbook_level_key)
);

create index if not exists idx_esl_scoring_calibration_user_level
    on esl_scoring_calibration(user_id, textbook_level_key);

alter table esl_scoring_calibration enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'esl_scoring_calibration'
          and policyname = 'Users manage own esl_scoring_calibration'
    ) then
        create policy "Users manage own esl_scoring_calibration"
            on esl_scoring_calibration
            for all
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end $$;
