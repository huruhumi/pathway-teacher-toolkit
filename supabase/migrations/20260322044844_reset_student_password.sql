-- Migration: Add RPC to reset student password securely
create or replace function reset_student_password(
        p_teacher_id uuid,
        p_student_id uuid,
        p_new_password text
    ) returns void language plpgsql security definer
set search_path = public,
    auth,
    extensions as $$
declare v_auth_id uuid;
begin -- 1. Verify ownership and get auth_user_id
select auth_user_id into v_auth_id
from public.students
where id = p_student_id
    and teacher_id = p_teacher_id;
if v_auth_id is null then raise exception 'Student not found, does not belong to this teacher, or not activated';
end if;
-- 2. Update password
update auth.users
set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
where id = v_auth_id;
end;
$$;