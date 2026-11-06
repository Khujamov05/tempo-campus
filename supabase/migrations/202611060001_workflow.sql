-- Dated changes, approval workflow and immutable publication history.
-- Additive migration: existing timetable and accounts are retained.
begin;

create function public.tempo_text(v jsonb, n integer, empty_ok boolean default false)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='string' and length(v #>> '{}') <= n
   and (empty_ok or length(btrim(v #>> '{}')) > 0), false);
$$;
create function public.tempo_date(v text) returns date
language plpgsql immutable set search_path='' as $$
declare d date;
begin
 if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date' using errcode='22023'; end if;
 d := v::date;
 if to_char(d,'YYYY-MM-DD') <> v then raise exception 'Invalid date' using errcode='22023'; end if;
 return d;
end;
$$;
create function public.tempo_occurs(l jsonb, d date) returns boolean
language sql immutable set search_path='' as $$
 select (extract(isodow from d)::int-1)=(l->>'day')::int
 and (l->>'frequency'='every' or (l->>'frequency'='even')=(extract(week from d)::int%2=0));
$$;
create function public.tempo_teacher(p jsonb, l jsonb) returns text
language sql immutable set search_path='' as $$
 select coalesce(l->>'teacherId',(select s->>'teacherId' from jsonb_array_elements(p->'subjects') s where s->>'id'=l->>'subjectId'));
$$;
create function public.tempo_on(p jsonb, d date) returns setof jsonb
language sql stable set search_path='' as $$
 select l || jsonb_build_object('originalDate',d::text,'date',d::text,'teacherId',public.tempo_teacher(p,l))
 from jsonb_array_elements(p->'lessons') l
 where public.tempo_occurs(l,d) and not exists (
  select 1 from jsonb_array_elements(coalesce(p->'exceptions','[]')) e
  where e->>'lessonId'=l->>'id' and e->>'originalDate'=d::text)
 union all
 select l || jsonb_build_object('originalDate',e->>'originalDate','date',e->>'date','teacherId',public.tempo_teacher(p,l),
   'start',e->>'start','end',e->>'end','room',e->>'room')
 from jsonb_array_elements(p->'lessons') l
 join jsonb_array_elements(coalesce(p->'exceptions','[]')) e on e->>'lessonId'=l->>'id'
 where e->>'date'=d::text and e->>'cancelled'='false';
$$;
create function public.tempo_conflict(p jsonb, a jsonb, b jsonb) returns boolean
language sql immutable set search_path='' as $$
 select a->>'start' < b->>'end' and b->>'start' < a->>'end' and (
 a->>'groupId'=b->>'groupId' or lower(btrim(a->>'room'))=lower(btrim(b->>'room')) or
 (nullif(public.tempo_teacher(p,a),'') is not null and public.tempo_teacher(p,a)=public.tempo_teacher(p,b)));
$$;
create function public.tempo_validate(p jsonb) returns void
language plpgsql stable set search_path='' as $$
declare k text; v jsonb; e jsonb; l jsonb; d date;
begin
 if p is null or jsonb_typeof(p) <> 'object' or p->'version' <> '1'::jsonb
   or not (p ? 'version') or octet_length(p::text)>2000000 then
  raise exception 'Invalid timetable structure' using errcode='22023';
 end if;
 foreach k in array array['teachers','subjects','groups','lessons'] loop
  if jsonb_typeof(p->k) is distinct from 'array' then raise exception 'Invalid timetable structure' using errcode='22023'; end if;
  if jsonb_array_length(p->k)>2000 or (k<>'lessons' and jsonb_array_length(p->k)=0) then raise exception 'Invalid collection size' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p->k) x where not public.tempo_text(x->'id',100))
    or exists(select 1 from jsonb_array_elements(p->k) x group by x->>'id' having count(*)>1) then
   raise exception 'Invalid or duplicate identifiers' using errcode='22023';
  end if;
 end loop;
 for v in select * from jsonb_array_elements(p->'teachers') loop
  if not public.tempo_text(v->'name',100) or not public.tempo_text(v->'department',120)
   or (v ? 'short' and not public.tempo_text(v->'short',60))
   or (v ? 'source' and (not public.tempo_text(v->'source',2000) or (v->>'source') !~ '^https://(www\.)?urdu\.uz/')) then
   raise exception 'Invalid teacher' using errcode='22023'; end if;
 end loop;
 for v in select * from jsonb_array_elements(p->'groups') loop
  if not public.tempo_text(v->'name',60) or not public.tempo_text(v->'description',150) then raise exception 'Invalid group' using errcode='22023'; end if;
 end loop;
 for v in select * from jsonb_array_elements(p->'subjects') loop
  if not public.tempo_text(v->'name',100) or not public.tempo_text(v->'code',30)
   or coalesce(v->>'color','') not in ('sage','lavender','peach','blue','yellow','rose')
   or not public.tempo_text(v->'teacherId',100,true)
   or (v->>'teacherId'<>'' and not exists(select 1 from jsonb_array_elements(p->'teachers') t where t->>'id'=v->>'teacherId')) then
   raise exception 'Invalid subject or teacher reference' using errcode='22023'; end if;
  if v ? 'additionalTeacherIds' then
   if jsonb_typeof(v->'additionalTeacherIds')<>'array' then raise exception 'Invalid teacher references' using errcode='22023'; end if;
   if exists(select 1 from jsonb_array_elements(v->'additionalTeacherIds') a where not public.tempo_text(a,100) or not exists(select 1 from jsonb_array_elements(p->'teachers') t where t->>'id'=a #>> '{}')) then
    raise exception 'Invalid teacher references' using errcode='22023'; end if;
  end if;
 end loop;
 for v in select * from jsonb_array_elements(p->'lessons') loop
  if not exists(select 1 from jsonb_array_elements(p->'subjects') s where s->>'id'=v->>'subjectId')
   or not exists(select 1 from jsonb_array_elements(p->'groups') g where g->>'id'=v->>'groupId')
   or (v ? 'teacherId' and not exists(select 1 from jsonb_array_elements(p->'teachers') t where t->>'id'=v->>'teacherId'))
   or jsonb_typeof(v->'day') is distinct from 'number' or coalesce(v->>'day','') !~ '^[0-5]$'
   or coalesce(v->>'frequency','') not in ('every','odd','even')
   or coalesce(v->>'type','') not in ('Лекция','Практика','Семинар','Лабораторная')
   or not public.tempo_text(v->'room',60) or not public.tempo_text(v->'note',1000,true)
   or coalesce(v->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   or coalesce(v->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
   raise exception 'Invalid lesson' using errcode='22023'; end if;
  if (v->>'start')<'08:00' or (v->>'end')>'20:00' or (v->>'end')::time-(v->>'start')::time<interval '30 minutes' then
   raise exception 'Invalid lesson time' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p->'lessons') a cross join jsonb_array_elements(p->'lessons') b
  where a->>'id'<b->>'id' and a->>'day'=b->>'day'
  and (a->>'frequency'='every' or b->>'frequency'='every' or a->>'frequency'=b->>'frequency')
  and public.tempo_conflict(p,a,b)) then raise exception 'Timetable conflict' using errcode='23P01'; end if;
 if p ? 'exceptions' then
  if jsonb_typeof(p->'exceptions') is distinct from 'array' then raise exception 'Invalid dated changes' using errcode='22023'; end if;
  if jsonb_array_length(p->'exceptions')>2000 or exists(select 1 from jsonb_array_elements(p->'exceptions') x group by x->>'lessonId',x->>'originalDate' having count(*)>1) then
   raise exception 'Duplicate or excessive dated changes' using errcode='22023'; end if;
  for e in select * from jsonb_array_elements(p->'exceptions') loop
   select x into l from jsonb_array_elements(p->'lessons') x where x->>'id'=e->>'lessonId';
   if l is null or not public.tempo_occurs(l,public.tempo_date(e->>'originalDate'))
    or extract(isodow from public.tempo_date(e->>'date'))=7
    or jsonb_typeof(e->'cancelled') is distinct from 'boolean'
    or not public.tempo_text(e->'room',60) or not public.tempo_text(e->'reason',1000)
    or coalesce((e->>'start')||'-'||(e->>'end'),'') not in ('08:30-09:50','10:00-11:20','11:30-12:50','13:30-14:50','15:00-16:20','16:30-17:50') then
    raise exception 'Invalid dated change' using errcode='22023'; end if;
  end loop;
  for d in select distinct public.tempo_date(x->>'date') from jsonb_array_elements(p->'exceptions') x loop
   if exists(select 1 from public.tempo_on(p,d) a cross join public.tempo_on(p,d) b
     where (a->>'id',a->>'originalDate') < (b->>'id',b->>'originalDate') and public.tempo_conflict(p,a,b)) then
    raise exception 'Timetable conflict' using errcode='23P01'; end if;
  end loop;
 end if;
 if exists(select 1 from public.profiles u where
  (u.teacher_id is not null and not exists(select 1 from jsonb_array_elements(p->'teachers') t where t->>'id'=u.teacher_id)) or
  (u.group_id is not null and not exists(select 1 from jsonb_array_elements(p->'groups') g where g->>'id'=u.group_id))) then
  raise exception 'An account is linked to a missing teacher or group' using errcode='23503'; end if;
end;
$$;

create table public.schedule_history (
 revision bigint primary key, payload jsonb not null,
 actor uuid, actor_label text not null,
 kind text not null check(kind in ('baseline','publish','approve','restore')),
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.schedule_requests (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id),
 author_label text not null, proposal jsonb not null, baseline jsonb not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewer_id uuid, review_note text not null default '', published_revision bigint
);
create unique index one_pending_occurrence on public.schedule_requests ((proposal->>'lessonId'),(proposal->>'originalDate')) where status='pending';
alter table public.schedule_history enable row level security;
alter table public.schedule_requests enable row level security;
revoke all on public.schedule_history, public.schedule_requests from anon, authenticated;
grant select on public.schedule_history, public.schedule_requests to authenticated;
create policy history_admin on public.schedule_history for select to authenticated using ((select public.is_tempo_admin()));
create policy request_owner_admin on public.schedule_requests for select to authenticated using(author_id=(select auth.uid()) or (select public.is_tempo_admin()));
insert into public.schedule_history(revision,payload,actor_label,kind)
 select revision,payload,'Tempo','baseline' from public.campus_schedule;

create function public.tempo_actor() returns text language sql stable security definer set search_path='' as $$
 select coalesce((select t->>'name' from public.campus_schedule s, jsonb_array_elements(s.payload->'teachers') t where t->>'id'=p.teacher_id), case when p.role='admin' then 'Администратор' else 'Преподаватель' end)
 from public.profiles p where p.id=auth.uid();
$$;
create function public.tempo_commit(p jsonb, expected bigint, event_kind text, event_details jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare r bigint;
begin
 if not public.is_tempo_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select revision into r from public.campus_schedule where id=1 for update;
 if r is distinct from expected then raise exception 'Schedule changed; reload before saving' using errcode='P0001'; end if;
 perform public.tempo_validate(p);
 update public.campus_schedule set payload=p, revision=r+1,updated_at=now() where id=1;
 insert into public.schedule_history(revision,payload,actor,actor_label,kind,details)
 values(r+1,p,auth.uid(),public.tempo_actor(),event_kind,event_details);
 return r+1;
end;
$$;
create or replace function public.save_campus_schedule(next_payload jsonb, expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
begin return public.tempo_commit(next_payload,expected_revision,'publish','{}'); end;
$$;
create function public.submit_schedule_request(change jsonb, expected_revision bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare p jsonb; r bigint; base jsonb; l jsonb; who public.profiles; result uuid; trial jsonb;
begin
 select * into who from public.profiles where id=auth.uid();
 if who.id is null or who.role not in ('admin','teacher') then raise exception 'Teacher or administrator required' using errcode='42501'; end if;
 select payload,revision into p,r from public.campus_schedule where id=1 for share;
 if r is distinct from expected_revision then raise exception 'Schedule changed; reload before saving' using errcode='P0001'; end if;
 select x into l from jsonb_array_elements(p->'lessons') x where x->>'id'=change->>'lessonId';
 if l is null or (who.role='teacher' and public.tempo_teacher(p,l) is distinct from who.teacher_id) then raise exception 'Only your own lessons' using errcode='42501'; end if;
 if public.tempo_date(change->>'date') < (now() at time zone 'Asia/Tashkent')::date then
  raise exception 'Choose a future date' using errcode='22023'; end if;
 select x into base from public.tempo_on(p,public.tempo_date(change->>'originalDate')) x
 where x->>'id'=change->>'lessonId' and x->>'originalDate'=change->>'originalDate';
 -- Requests for an already moved occurrence use its actual date.
 if base is null then
  select x into base from jsonb_array_elements(coalesce(p->'exceptions','[]')) e,
   lateral public.tempo_on(p,public.tempo_date(e->>'date')) x
  where e->>'lessonId'=change->>'lessonId' and e->>'originalDate'=change->>'originalDate'
   and x->>'id'=change->>'lessonId' and x->>'originalDate'=change->>'originalDate';
 end if;
 if base is null then raise exception 'Lesson occurrence is unavailable' using errcode='P0001'; end if;
 if public.tempo_date(base->>'date') < (now() at time zone 'Asia/Tashkent')::date then raise exception 'Choose a future date' using errcode='22023'; end if;
 trial:=jsonb_set(p,'{exceptions}',coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(p->'exceptions','[]')) e
   where not(e->>'lessonId'=change->>'lessonId' and e->>'originalDate'=change->>'originalDate')),'[]')||jsonb_build_array(change));
 -- Keep conflicting proposals for review, but validate their structure and references.
 begin perform public.tempo_validate(trial); exception when exclusion_violation then null; end;
 insert into public.schedule_requests(author_id,author_label,proposal,baseline) values(auth.uid(),public.tempo_actor(),change,base) returning id into result;
 return result;
end;
$$;
create function public.review_schedule_request(request_id uuid, approve boolean, note text, expected_revision bigint) returns bigint
language plpgsql security definer set search_path='' as $$
declare p jsonb; r bigint; req public.schedule_requests; actual jsonb; next_p jsonb; result bigint;
begin
 if not public.is_tempo_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select payload,revision into p,r from public.campus_schedule where id=1 for update;
 select * into req from public.schedule_requests where id=request_id for update;
 if req.id is null or req.status<>'pending' then raise exception 'Request already processed' using errcode='P0001'; end if;
 if approve is null or note is null or length(note)>1000 or (not approve and length(btrim(note))=0) then raise exception 'Add a review comment' using errcode='22023'; end if;
 if approve then
  if r is distinct from expected_revision then raise exception 'Schedule changed; reload before saving' using errcode='P0001'; end if;
  select x into actual from public.tempo_on(p,public.tempo_date(req.baseline->>'date')) x
   where x->>'id'=req.proposal->>'lessonId' and x->>'originalDate'=req.proposal->>'originalDate';
  if actual is distinct from req.baseline then raise exception 'Lesson changed after request; ask for a new request' using errcode='P0001'; end if;
  if public.tempo_date(req.proposal->>'date') < (now() at time zone 'Asia/Tashkent')::date or public.tempo_date(req.baseline->>'date') < (now() at time zone 'Asia/Tashkent')::date then raise exception 'Request date has passed' using errcode='22023'; end if;
  next_p:=jsonb_set(p,'{exceptions}',coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(p->'exceptions','[]')) e
    where not(e->>'lessonId'=req.proposal->>'lessonId' and e->>'originalDate'=req.proposal->>'originalDate')),'[]')||jsonb_build_array(req.proposal));
  result:=public.tempo_commit(next_p,r,'approve',jsonb_build_object('requestId',req.id,'subjectId',req.baseline->>'subjectId','groupId',req.baseline->>'groupId','before',req.baseline-'note','after',req.proposal-'reason'));
 end if;
 update public.schedule_requests set status=case when approve then 'approved' else 'rejected' end,
   reviewer_id=auth.uid(),reviewed_at=now(),review_note=btrim(note),published_revision=result where id=req.id;
 return coalesce(result,r);
end;
$$;
create function public.withdraw_schedule_request(request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.schedule_requests set status='withdrawn',reviewed_at=now() where id=request_id and author_id=auth.uid() and status='pending';
 if not found then raise exception 'Pending own request required' using errcode='42501'; end if;
end;
$$;
create function public.restore_schedule_version(source_revision bigint, expected_revision bigint) returns bigint
language plpgsql security definer set search_path='' as $$
declare p jsonb;
begin
 if not public.is_tempo_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select payload into p from public.schedule_history where revision=source_revision;
 if p is null then raise exception 'Version not found' using errcode='22023'; end if;
 return public.tempo_commit(p,expected_revision,'restore',jsonb_build_object('sourceRevision',source_revision));
end;
$$;
create function public.list_schedule_updates() returns table(revision bigint, created_at timestamptz, kind text, actor_label text, details jsonb)
language sql stable security definer set search_path='' as $$
 select h.revision,h.created_at,h.kind,h.actor_label,h.details from public.schedule_history h
 where exists(select 1 from public.profiles where id=auth.uid()) order by h.revision desc limit 50;
$$;
create function public.list_tempo_accounts() returns table(id uuid,role text,teacher_id text,group_id text,display_name text,email text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_tempo_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return query select p.id,p.role,p.teacher_id,p.group_id,
  coalesce((select t->>'name' from public.campus_schedule s,jsonb_array_elements(s.payload->'teachers') t where t->>'id'=p.teacher_id),split_part(u.email,'@',1)),u.email::text
  from public.profiles p join auth.users u on u.id=p.id order by u.email;
end;
$$;
-- Explicit function allowlist. Helpers are never exposed for direct execution.
revoke all on function public.tempo_text(jsonb,integer,boolean), public.tempo_date(text), public.tempo_occurs(jsonb,date), public.tempo_teacher(jsonb,jsonb), public.tempo_on(jsonb,date), public.tempo_conflict(jsonb,jsonb,jsonb), public.tempo_validate(jsonb), public.tempo_actor(), public.tempo_commit(jsonb,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.submit_schedule_request(jsonb,bigint),public.review_schedule_request(uuid,boolean,text,bigint),public.withdraw_schedule_request(uuid),public.restore_schedule_version(bigint,bigint),public.list_schedule_updates(),public.list_tempo_accounts() from public,anon;
grant execute on function public.submit_schedule_request(jsonb,bigint),public.review_schedule_request(uuid,boolean,text,bigint),public.withdraw_schedule_request(uuid),public.restore_schedule_version(bigint,bigint),public.list_schedule_updates(),public.list_tempo_accounts() to authenticated;
-- Validate existing data before committing any migration changes.
select public.tempo_validate(payload) from public.campus_schedule where id=1;
commit;
