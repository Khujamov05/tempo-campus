begin;
create or replace function public.tempo_conflict(p jsonb,a jsonb,b jsonb) returns boolean language sql immutable set search_path='' as $$
select a->>'start'<b->>'end' and b->>'start'<a->>'end' and (
lower(trim(a->>'room'))=lower(trim(b->>'room'))
or exists(select jsonb_array_elements_text(jsonb_build_array(a->>'groupId')||coalesce(a->'extraGroups','[]'))
intersect select jsonb_array_elements_text(jsonb_build_array(b->>'groupId')||coalesce(b->'extraGroups','[]')))
or exists(select x from jsonb_array_elements_text(jsonb_build_array(public.tempo_teacher(p,a))||coalesce(a->'assistants','[]')) x where x<>''
intersect select jsonb_array_elements_text(jsonb_build_array(public.tempo_teacher(p,b))||coalesce(b->'assistants','[]'))));
$$;

alter function public.tempo_validate(jsonb) rename to tempo_validate_legacy;
create function public.tempo_validate(p jsonb) returns void language plpgsql stable set search_path='' as $$
declare l jsonb; r jsonb; item jsonb; k text; members jsonb; catalog jsonb;
begin
 for r in select * from jsonb_array_elements(coalesce(p->'rooms','[]')) loop
  if not public.tempo_text(r->'name',60) or coalesce(r->>'seats','') !~ '^[1-9][0-9]*$' or coalesce(r->>'computers','') !~ '^(0|[1-9][0-9]*)$'
  or jsonb_typeof(r->'seats') is distinct from 'number' or jsonb_typeof(r->'computers') is distinct from 'number' or (r->>'computers')::numeric>(r->>'seats')::numeric or jsonb_typeof(r->'screen') is distinct from 'boolean' then raise exception 'Invalid room' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p->'rooms') x group by lower(trim(x->>'name')) having count(*)>1) then raise exception 'Duplicate room' using errcode='22023'; end if;
 for l in select * from jsonb_array_elements(p->'lessons') loop
  foreach k in array array['extraGroups','assistants'] loop
   members:=coalesce(l->k,'[]')||jsonb_build_array(case when k='extraGroups' then l->>'groupId' else public.tempo_teacher(p,l) end);
   catalog:=case when k='extraGroups' then p->'groups' else p->'teachers' end;
   if (l?k and jsonb_typeof(l->k)<>'array') or exists(select 1 from jsonb_array_elements(l->k) x where not exists(select 1 from jsonb_array_elements(catalog) c where c->'id'=x)) or exists(select 1 from jsonb_array_elements(members) x group by x having count(*)>1) then raise exception 'Invalid participant' using errcode='22023'; end if;
  end loop;
  foreach k in array array['seats','computers'] loop
   if l?k and (jsonb_typeof(l->k)<>'number' or l->>k !~ '^(0|[1-9][0-9]*)$') then raise exception 'Invalid requirement' using errcode='22023'; end if;
  end loop;
  if l?'screen' and jsonb_typeof(l->'screen')<>'boolean' then raise exception 'Invalid screen' using errcode='22023'; end if;
  for item in select l union all select e from jsonb_array_elements(p->'exceptions') e where e->>'lessonId'=l->>'id' and e->>'cancelled'='false' loop
   select x into r from jsonb_array_elements(p->'rooms') x where lower(trim(x->>'name'))=lower(trim(item->>'room'));
   if coalesce((l->>'seats')::numeric,0)>coalesce((r->>'seats')::numeric,0) or coalesce((l->>'computers')::numeric,0)>coalesce((r->>'computers')::numeric,0) or (l->>'screen'='true' and coalesce(r->>'screen','false')<>'true') then raise exception 'Room does not meet requirements' using errcode='22023'; end if;
  end loop;
 end loop;
 perform public.tempo_validate_legacy(p);
end;
$$;
revoke all on function public.tempo_validate(jsonb) from public,anon,authenticated;
create or replace function public.submit_schedule_request(change jsonb, expected_revision bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare p jsonb; r bigint; base jsonb; l jsonb; who public.profiles; result uuid; trial jsonb;
begin
 select * into who from public.profiles where id=auth.uid();
 if who.id is null or who.role not in ('admin','teacher') then raise exception 'Teacher or administrator required' using errcode='42501'; end if;
 select payload,revision into p,r from public.campus_schedule where id=1 for share;
 if r is distinct from expected_revision then raise exception 'Schedule changed; reload before saving' using errcode='P0001'; end if;
 select x into l from jsonb_array_elements(p->'lessons') x where x->>'id'=change->>'lessonId';
 if l is null or (who.role='teacher' and (who.teacher_id is null or (public.tempo_teacher(p,l) is distinct from who.teacher_id and not coalesce(l->'assistants','[]') ? who.teacher_id))) then raise exception 'Only your own lessons' using errcode='42501'; end if;
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

select public.tempo_validate(payload) from public.campus_schedule;
commit;
