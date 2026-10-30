import { describe, expect, it } from 'vitest';
import { accountLessons, canManageSchedule, defaultScope, type Profile } from './access';
import { createDemo, type Lesson } from './model';

const teacher: Profile = { id: 'u1', role: 'teacher', teacher_id: 't1', group_id: null };
const week = new Date(2027, 0, 4); // ISO week 1
const lesson = (id: string, groupId: string, teacherId?: string): Lesson => ({
  id,
  groupId,
  subjectId: 's1',
  teacherId,
  day: 0,
  start: '08:30',
  end: '09:50',
  room: id,
  type: 'Лекция',
  frequency: 'every',
  note: '',
});

describe('account schedule defaults', () => {
  it('opens teachers on their own lessons across groups', () => {
    const data = createDemo();
    data.subjects[0].teacherId = 't1';
    data.lessons = [lesson('a', 'g1'), lesson('b', 'g2', 't1'), lesson('c', 'g1', 't2')];
    expect(defaultScope(teacher)).toBe('mine');
    expect(accountLessons(data, teacher, week, 'mine', 'g1').map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('does not show everybody as own lessons when the teacher is not linked', () => {
    expect(
      accountLessons(createDemo(), { ...teacher, teacher_id: null }, week, 'mine', 'g1'),
    ).toEqual([]);
  });
  it('shows students all subjects in their selected group and respects week parity', () => {
    const data = createDemo();
    data.lessons = [lesson('a', 'g1', 't1'), lesson('b', 'g1', 't2'), lesson('c', 'g2')];
    data.lessons.push({ ...lesson('d', 'g1'), frequency: 'even' });
    const student: Profile = { ...teacher, role: 'student', teacher_id: null, group_id: 'g1' };
    expect(defaultScope(student)).toBe('group');
    expect(accountLessons(data, student, week, 'group', 'g1').map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('only administrators can manage the shared schedule', () => {
    expect(canManageSchedule(null)).toBe(false);
    expect(canManageSchedule(teacher)).toBe(false);
    expect(canManageSchedule({ ...teacher, role: 'student' })).toBe(false);
    expect(canManageSchedule({ ...teacher, role: 'admin' })).toBe(true);
  });
});
