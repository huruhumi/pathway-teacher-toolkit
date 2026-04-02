-- ============================================================
-- Record recycle-bin support (safe-first)
-- - Adds soft-delete columns only (no data mutation)
-- - Adds purge helper function with OFF-by-default gate
-- - No cron job is enabled in this migration
-- ============================================================

-- ESL / Nature / Essay record tables
alter table if exists esl_lessons
    add column if not exists deleted_at timestamptz,
    add column if not exists purge_at timestamptz,
    add column if not exists deleted_by uuid references auth.users(id);

alter table if exists esl_curricula
    add column if not exists deleted_at timestamptz,
    add column if not exists purge_at timestamptz,
    add column if not exists deleted_by uuid references auth.users(id);

alter table if exists lesson_plans
    add column if not exists deleted_at timestamptz,
    add column if not exists purge_at timestamptz,
    add column if not exists deleted_by uuid references auth.users(id);

alter table if exists curricula
    add column if not exists deleted_at timestamptz,
    add column if not exists purge_at timestamptz,
    add column if not exists deleted_by uuid references auth.users(id);

alter table if exists essay_records
    add column if not exists deleted_at timestamptz,
    add column if not exists purge_at timestamptz,
    add column if not exists deleted_by uuid references auth.users(id);

-- Soft-delete query and cleanup indexes
do $$
begin
    if to_regclass('public.esl_lessons') is not null then
        execute 'create index if not exists idx_esl_lessons_user_deleted_at on esl_lessons(user_id, deleted_at desc)';
        execute 'create index if not exists idx_esl_lessons_purge_at on esl_lessons(purge_at) where deleted_at is not null';
    end if;

    if to_regclass('public.esl_curricula') is not null then
        execute 'create index if not exists idx_esl_curricula_user_deleted_at on esl_curricula(user_id, deleted_at desc)';
        execute 'create index if not exists idx_esl_curricula_purge_at on esl_curricula(purge_at) where deleted_at is not null';
    end if;

    if to_regclass('public.lesson_plans') is not null then
        execute 'create index if not exists idx_lesson_plans_user_deleted_at on lesson_plans(user_id, deleted_at desc)';
        execute 'create index if not exists idx_lesson_plans_purge_at on lesson_plans(purge_at) where deleted_at is not null';
    end if;

    if to_regclass('public.curricula') is not null then
        execute 'create index if not exists idx_curricula_user_deleted_at on curricula(user_id, deleted_at desc)';
        execute 'create index if not exists idx_curricula_purge_at on curricula(purge_at) where deleted_at is not null';
    end if;

    if to_regclass('public.essay_records') is not null then
        execute 'create index if not exists idx_essay_records_user_deleted_at on essay_records(user_id, deleted_at desc)';
        execute 'create index if not exists idx_essay_records_purge_at on essay_records(purge_at) where deleted_at is not null';
    end if;
end $$;

-- OFF-by-default purge gate (phase 3 requires manual approval)
create table if not exists record_maintenance_settings (
    id boolean primary key default true check (id = true),
    recycle_purge_enabled boolean not null default false,
    updated_at timestamptz not null default now()
);

insert into record_maintenance_settings (id, recycle_purge_enabled)
values (true, false)
on conflict (id) do nothing;

create or replace function public.run_record_purge_if_enabled(max_rows_per_table integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    enabled boolean;
    table_name text;
    deleted_count integer;
    deleted_summary jsonb := '{}'::jsonb;
    target_tables text[] := array['esl_lessons', 'esl_curricula', 'lesson_plans', 'curricula', 'essay_records'];
begin
    select recycle_purge_enabled
    into enabled
    from public.record_maintenance_settings
    where id = true;

    if coalesce(enabled, false) = false then
        return jsonb_build_object(
            'enabled', false,
            'deleted', deleted_summary
        );
    end if;

    foreach table_name in array target_tables loop
        if to_regclass(format('public.%s', table_name)) is null then
            deleted_summary := deleted_summary || jsonb_build_object(table_name, 0);
            continue;
        end if;

        execute format(
            $sql$
            with doomed as (
                select id, user_id
                from %I
                where deleted_at is not null
                  and purge_at is not null
                  and purge_at <= now()
                order by purge_at asc
                limit %s
            ),
            deleted_rows as (
                delete from %I t
                using doomed d
                where t.id = d.id
                  and t.user_id = d.user_id
                returning t.id, t.user_id
            ),
            cleaned_index as (
                delete from record_index ri
                using deleted_rows dr
                where ri.record_id = dr.id
                  and ri.owner_id = dr.user_id
                returning 1
            )
            select coalesce((select count(*) from deleted_rows), 0)
            $sql$,
            table_name,
            greatest(1, max_rows_per_table),
            table_name
        )
        into deleted_count;

        deleted_summary := deleted_summary || jsonb_build_object(table_name, coalesce(deleted_count, 0));
    end loop;

    return jsonb_build_object(
        'enabled', true,
        'deleted', deleted_summary
    );
end;
$$;

comment on function public.run_record_purge_if_enabled(integer) is
'Phase-3 purge entrypoint. Purge only runs when record_maintenance_settings.recycle_purge_enabled = true.';

-- Phase-3 manual enable examples (do not auto-run here):
--   update public.record_maintenance_settings set recycle_purge_enabled = true, updated_at = now() where id = true;
--   select public.run_record_purge_if_enabled(500);
--   -- Optional cron job (manual approval required):
--   -- select cron.schedule('records-purge-daily', '15 3 * * *', $$select public.run_record_purge_if_enabled(500);$$);
