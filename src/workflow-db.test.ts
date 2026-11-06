import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import accountsSql from '../supabase/migrations/202610300001_accounts.sql?raw';
import workflowSql from '../supabase/migrations/202611060001_workflow.sql?raw';
import { createDemo } from './model';
const db = new PGlite();
const admin = '00000000-0000-0000-0000-000000000001';
const teacher = '00000000-0000-0000-0000-000000000002';
const student = '00000000-0000-0000-0000-000000000003';
const demo = createDemo();
demo.lessons = [
  {
    id: 'l1',
    subjectId: 's1',
    groupId: 'g1',
    day: 0,
    start: '08:30',
    end: '09:50',
    room: '301',
    type: 'Лекция',
    frequency: 'every',
    note: '',
  },
];
demo.subjects[0].teacherId = 't1';
const proposal = {
  lessonId: 'l1',
  originalDate: '2099-01-05',
  date: '2099-01-06',
  start: '10:00',
  end: '11:20',
  room: '204',
  cancelled: false,
  reason: 'Department meeting',
};
async function as(id: string, sql: string, args: unknown[] = []) {
  await db.exec(`set role authenticated;`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  return db.query<Record<string, unknown>>(sql, args);
}
async function owner(sql: string, args: unknown[] = []) {
  await db.exec('reset role');
  return db.query(sql, args);
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(accountsSql);
  await owner('insert into auth.users values ($1,$2),($3,$4),($5,$6)', [
    admin,
    'admin@example.test',
    teacher,
    'teacher@example.test',
    student,
    'student@example.test',
  ]);
  await owner("update public.profiles set role='admin' where id=$1", [admin]);
  await owner("update public.profiles set role='teacher',teacher_id='t1' where id=$1", [teacher]);
  await owner('insert into public.campus_schedule(id,payload) values(1,$1)', [
    JSON.stringify(demo),
  ]);
  await db.exec(workflowSql);
}, 30000);
afterAll(async () => {
  await db.close();
});
describe('PostgreSQL workflow and authorization', () => {
  it('denies students, enforces own lessons and hides other profiles', async () => {
    await expect(
      as(student, 'select public.submit_schedule_request($1,1)', [JSON.stringify(proposal)]),
    ).rejects.toMatchObject({ code: '42501' });
    await owner("update public.profiles set teacher_id='t2' where id=$1", [teacher]);
    await expect(
      as(teacher, 'select public.submit_schedule_request($1,1)', [JSON.stringify(proposal)]),
    ).rejects.toMatchObject({ code: '42501' });
    await owner("update public.profiles set teacher_id='t1' where id=$1", [teacher]);
    await expect(
      as(teacher, 'select public.save_campus_schedule($1,1)', [JSON.stringify(demo)]),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(as(teacher, 'select public.list_tempo_accounts()')).rejects.toMatchObject({
      code: '42501',
    });
    const profiles = await as(student, 'select * from public.profiles');
    expect(profiles.rows).toHaveLength(1);
    expect((await as(student, 'select * from public.schedule_history')).rows).toHaveLength(0);
  });
  it('submits, approves atomically, stores history and rejects duplicate processing', async () => {
    const result = await as(teacher, 'select public.submit_schedule_request($1,1) as id', [
      JSON.stringify(proposal),
    ]);
    const id = result.rows[0].id;
    expect((await as(student, 'select * from public.schedule_requests')).rows).toHaveLength(0);
    await expect(
      as(teacher, "select public.review_schedule_request($1,true,'',1)", [id]),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      as(teacher, 'select public.submit_schedule_request($1,1)', [JSON.stringify(proposal)]),
    ).rejects.toMatchObject({ code: '23505' });
    await as(admin, "select public.review_schedule_request($1,true,'Approved',1)", [id]);
    expect(
      (await as(admin, 'select payload from public.campus_schedule')).rows[0].payload,
    ).toMatchObject({ exceptions: [proposal] });
    expect((await as(admin, 'select * from public.schedule_history')).rows).toHaveLength(2);
    await expect(
      as(admin, "select public.review_schedule_request($1,true,'',2)", [id]),
    ).rejects.toMatchObject({ code: 'P0001' });
  });
  it('validates direct API writes and retains prior version after failure', async () => {
    const bad = structuredClone(demo);
    bad.lessons[0].groupId = 'missing';
    await expect(
      as(admin, 'select public.save_campus_schedule($1,2)', [JSON.stringify(bad)]),
    ).rejects.toMatchObject({ code: '22023' });
    bad.lessons[0].groupId = 'g1';
    bad.lessons.push({ ...bad.lessons[0], id: 'l2' });
    await expect(
      as(admin, 'select public.save_campus_schedule($1,2)', [JSON.stringify(bad)]),
    ).rejects.toMatchObject({ code: '23P01' });
    expect((await as(admin, 'select revision from public.campus_schedule')).rows[0].revision).toBe(
      2,
    );
  });
  it('restores by creating a new version and rejects stale saves', async () => {
    await expect(as(student, 'select public.restore_schedule_version(1,2)')).rejects.toMatchObject({
      code: '42501',
    });
    await as(admin, 'select public.restore_schedule_version(1,2)');
    expect((await as(admin, 'select payload from public.campus_schedule')).rows[0].payload).toEqual(
      demo,
    );
    await expect(
      as(admin, 'select public.save_campus_schedule($1,2)', [JSON.stringify(demo)]),
    ).rejects.toMatchObject({ code: 'P0001' });
    expect((await as(student, 'select * from public.list_schedule_updates()')).rows).toHaveLength(
      3,
    );
  });
  it('keeps conflicting requests pending and detects stale proposals', async () => {
    const conflicted = {
      ...demo,
      lessons: [
        ...demo.lessons,
        { ...demo.lessons[0], id: 'l2', day: 1, start: '10:00', end: '11:20' },
      ],
    };
    await as(admin, 'select public.save_campus_schedule($1,3)', [JSON.stringify(conflicted)]);
    const { rows } = await as(teacher, 'select public.submit_schedule_request($1,4) as id', [
      JSON.stringify(proposal),
    ]);
    await expect(
      as(admin, "select public.review_schedule_request($1,true,'',4)", [rows[0].id]),
    ).rejects.toMatchObject({ code: '23P01' });
    expect(
      (await as(admin, 'select status from public.schedule_requests where id=$1', [rows[0].id]))
        .rows[0].status,
    ).toBe('pending');
    await as(admin, 'select public.save_campus_schedule($1,4)', [
      JSON.stringify({
        ...conflicted,
        lessons: conflicted.lessons.map((l) => ({ ...l, room: 'changed' })),
      }),
    ]);
    await expect(
      as(admin, "select public.review_schedule_request($1,true,'',5)", [rows[0].id]),
    ).rejects.toMatchObject({ code: 'P0001' });
    await as(admin, "select public.review_schedule_request($1,false,'Please resubmit',5)", [
      rows[0].id,
    ]);
  });
  it('supports cancellation and withdrawal without exposing helper functions', async () => {
    const { rows } = await as(teacher, 'select public.submit_schedule_request($1,5) as id', [
      JSON.stringify({ ...proposal, cancelled: true }),
    ]);
    await expect(
      as(student, 'select public.withdraw_schedule_request($1)', [rows[0].id]),
    ).rejects.toMatchObject({ code: '42501' });
    await as(teacher, 'select public.withdraw_schedule_request($1)', [rows[0].id]);
    await expect(
      as(admin, "select public.tempo_commit($1,5,'publish','{}')", [JSON.stringify(demo)]),
    ).rejects.toMatchObject({ code: '42501' });
    await db.exec('set role anon');
    await expect(db.query('select * from public.campus_schedule')).rejects.toMatchObject({
      code: '42501',
    });
  });
});
