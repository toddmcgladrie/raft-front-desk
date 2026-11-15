begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'raft_admin') then
    create role raft_admin nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'raft_scheduler') then
    create role raft_scheduler nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'raft_counselor') then
    create role raft_counselor nologin;
  end if;
end;
$$;

grant raft_admin, raft_scheduler, raft_counselor to authenticator;

revoke all on schema raft from public, anon, authenticated;
revoke all on all tables in schema raft from public, anon, authenticated, raft_admin, raft_scheduler, raft_counselor;
revoke all on all sequences in schema raft from public, anon, authenticated, raft_admin, raft_scheduler, raft_counselor;
grant usage on schema raft to raft_admin, raft_scheduler, raft_counselor;

grant select, insert, update on all tables in schema raft to raft_admin;
grant usage on all sequences in schema raft to raft_admin;

grant select on raft.person, raft.client, raft.counselor, raft.family_member,
  raft.room, raft.family, raft.member_in_family, raft.role, raft.member_role to raft_scheduler;
grant insert, update on raft.person, raft.client, raft.room to raft_scheduler;
grant select (employeeid, datehired, supervisorid) on raft.employee to raft_scheduler;
grant select (appointmentid, appointmenttime, duration, counselorid, employeeid, roomnumber),
  insert (appointmenttime, duration, counselorid, employeeid, roomnumber),
  update (appointmenttime, duration, counselorid, employeeid, roomnumber)
  on raft.appointment to raft_scheduler;
grant select (appointmentid, clientid, kept), insert (appointmentid, clientid, kept),
  update (appointmentid, clientid, kept) on raft.scheduledfor to raft_scheduler;
grant usage on all sequences in schema raft to raft_scheduler;

grant select on raft.person, raft.client, raft.counselor, raft.family_member,
  raft.room, raft.family, raft.member_in_family, raft.role, raft.member_role,
  raft.appointment, raft.scheduledfor to raft_counselor;
grant select (employeeid, datehired, supervisorid) on raft.employee to raft_counselor;
grant update (notes) on raft.appointment to raft_counselor;
grant update (assignment, kept) on raft.scheduledfor to raft_counselor;

create or replace function public.raft_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  staff text;
begin
  select raw_app_meta_data->>'staff_role' into staff
  from auth.users where id = (event->>'user_id')::uuid;

  if staff in ('admin', 'scheduler', 'counselor') then
    return jsonb_set(event, '{claims,role}', to_jsonb('raft_' || staff));
  end if;
  return event;
end;
$$;

revoke execute on function public.raft_access_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant select (id, raw_app_meta_data) on auth.users to supabase_auth_admin;
grant execute on function public.raft_access_token_hook(jsonb) to supabase_auth_admin;

notify pgrst, 'reload schema';
commit;
