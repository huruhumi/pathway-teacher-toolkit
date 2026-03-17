-- ============================================================
-- ESL teacher review feedback storage
-- ============================================================

create table if not exists teacher_reviews (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    record_id text not null,
    accepted boolean not null default false,
    edited_sections jsonb not null default '[]'::jsonb,
    comment text,
    final_score numeric,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, record_id)
);

create index if not exists idx_teacher_reviews_user_updated
    on teacher_reviews(user_id, updated_at desc);

alter table teacher_reviews enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'teacher_reviews'
          and policyname = 'Users manage own teacher_reviews'
    ) then
        create policy "Users manage own teacher_reviews"
            on teacher_reviews
            for all
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end $$;
