-- Apply to a NEW Tempo Supabase project. First admin is provisioned by the owner
-- in the SQL editor, never through sign-up metadata or the browser.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  teacher_id text,
  group_id text,
  constraint teacher_link_required check (role <> 'teacher' or teacher_id is not null)
);
create unique index one_account_per_teacher on public.profiles (teacher_id)
  where teacher_id is not null;

create table public.campus_schedule (
  id integer primary key check (id = 1),
  payload jsonb not null check (coalesce(
    jsonb_typeof(payload) = 'object' and payload->>'version' = '1'
    and jsonb_typeof(payload->'teachers') = 'array'
    and jsonb_typeof(payload->'subjects') = 'array'
    and jsonb_typeof(payload->'groups') = 'array'
    and jsonb_typeof(payload->'lessons') = 'array'
  , false)),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create function public.create_student_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role) values (new.id, 'student');
  return new;
end;
$$;
create trigger tempo_new_user after insert on auth.users
for each row execute function public.create_student_profile();
insert into public.profiles (id) select id from auth.users on conflict do nothing;

create function public.is_tempo_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.campus_schedule enable row level security;
revoke all on public.profiles, public.campus_schedule from anon, authenticated;
grant select on public.profiles, public.campus_schedule to authenticated;
create policy read_profile on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_tempo_admin()));
create policy read_schedule on public.campus_schedule for select to authenticated
  using (exists(select 1 from public.profiles where id = (select auth.uid())));

-- Only this checked RPC can update shared data; a stale revision cannot overwrite
-- another administrator's changes. First publication expects revision 0.
create function public.save_campus_schedule(next_payload jsonb, expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare new_revision bigint;
begin
  if not public.is_tempo_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if expected_revision = 0 then
    insert into public.campus_schedule (id, payload) values (1, next_payload)
      on conflict do nothing returning revision into new_revision;
  else
    update public.campus_schedule set payload = next_payload, revision = revision + 1, updated_at = now()
      where id = 1 and revision = expected_revision returning revision into new_revision;
  end if;
  if new_revision is null then raise exception 'Schedule changed; reload before saving' using errcode = 'P0001'; end if;
  return new_revision;
end;
$$;

create function public.assign_tempo_role(target_user uuid, next_role text, linked_teacher text default null, linked_group text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_tempo_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if target_user = auth.uid() then raise exception 'Cannot change own role'; end if;
  if next_role not in ('student', 'teacher', 'admin') or next_role is null then raise exception 'Invalid role'; end if;
  if next_role = 'teacher' and not exists (
    select 1 from public.campus_schedule, jsonb_array_elements(payload->'teachers') as teacher
    where teacher->>'id' = linked_teacher
  ) then raise exception 'Select an existing teacher'; end if;
  if linked_group is not null and not exists (
    select 1 from public.campus_schedule, jsonb_array_elements(payload->'groups') as grp
    where grp->>'id' = linked_group
  ) then raise exception 'Select an existing group'; end if;
  update public.profiles set role = next_role,
    teacher_id = case when next_role = 'teacher' then linked_teacher else null end,
    group_id = linked_group where id = target_user;
  if not found then raise exception 'Account not found'; end if;
end;
$$;
revoke all on function public.create_student_profile() from public, anon, authenticated;
revoke all on function public.is_tempo_admin() from public, anon;
revoke all on function public.save_campus_schedule(jsonb, bigint) from public, anon;
revoke all on function public.assign_tempo_role(uuid, text, text, text) from public, anon;
grant execute on function public.is_tempo_admin() to authenticated;
grant execute on function public.save_campus_schedule(jsonb, bigint) to authenticated;
grant execute on function public.assign_tempo_role(uuid, text, text, text) to authenticated;
commit;
