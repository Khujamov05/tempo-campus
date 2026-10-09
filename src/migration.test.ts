import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDemo,
  migrateLegacy,
  migrateSchedule,
  lessonTeacher,
  subjectTeachers,
  validateLesson,
  parseData,
  calendarExport,
  loadData,
  STORAGE_KEY,
} from './model';

afterEach(() => vi.unstubAllGlobals());
function legacy() {
  const data = createDemo();
  data.teachers = data.teachers.filter((t) => !['t6', 't7', 't8'].includes(t.id));
  const names = [
    'Каримова Алина Рустамовна',
    'Петров Максим Андреевич',
    'Юсупова Диана Алишеровна',
    'Соколов Артём Ильич',
    'Мирзаев Тимур Олегович',
  ];
  data.teachers.forEach((t) => {
    t.name = names[Number(t.id.slice(1)) - 1];
    delete t.short;
    delete t.source;
  });
  const subjects = [
    'Высшая математика',
    'Алгоритмы и структуры данных',
    'Английский язык',
    'Базы данных',
    'Философия',
    'Веб-разработка',
  ];
  data.subjects.forEach((s) => {
    s.name = subjects[Number(s.id.slice(1)) - 1];
    delete s.additionalTeacherIds;
  });
  data.lessons.forEach((l) => delete l.teacherId);
  return data;
}

describe('UrDU data and instructors', () => {
  it('includes both project-management teachers and the supplied methodology teacher', () => {
    const data = createDemo();
    expect(subjectTeachers(data.subjects[0], data).map((t) => t.short)).toEqual([
      'Xusainov Sh. M.',
      'Yuldashov O. E.',
    ]);
    expect(subjectTeachers(data.subjects[2], data)[0].name).toBe('Sattarova Sapura Beknazarovna');
    expect(data.teachers.some((t) => /[А-Яа-яЁё]/.test(t.name))).toBe(false);
  });
  it('checks the selected lesson instructor, including across different subjects', () => {
    const data = createDemo();
    const original = data.lessons.find((l) => l.teacherId === 't6')!;
    data.lessons = [original];
    const candidate = { ...original, id: 'new', groupId: 'g2', room: '999', subjectId: 's2' };
    expect(validateLesson(candidate, data)).toContain('Преподаватель');
    expect(validateLesson({ ...candidate, teacherId: 't1' }, data)).toBeNull();
    expect(validateLesson({ ...candidate, teacherId: 'missing' }, data)).toContain('справочника');
  });
  it('exports the assigned teacher and translated format', () => {
    const data = createDemo();
    const lesson = data.lessons.find((l) => l.teacherId === 't6')!;
    expect(lessonTeacher(lesson, data)?.short).toBe('Yuldashov O. E.');
    const ics = calendarExport([lesson], data, new Date(2026, 9, 5), 'en').replace(/\r\n /g, '');
    expect(ics).toContain('Practice · Yuldashov Ollabergan');
    expect(ics).toContain('LOCATION:Room 301');
  });
  it('rejects broken secondary-teacher references in imported data', () => {
    const data = createDemo();
    data.subjects[0].additionalTeacherIds = ['missing'];
    expect(() => parseData(JSON.stringify(data))).toThrow();
  });
});

describe('upgrading existing browsers', () => {
  it('upgrades starter groups, preserves lesson links and keeps custom groups', () => {
    const data = createDemo();
    data.groups = data.groups.slice(0, 2);
    data.groups[0].name = 'KI-21';
    data.groups[1].name = 'KI-22';
    data.groups.push({ id: 'g3', name: 'My group', description: 'Personal' });
    const updated = migrateSchedule(data);
    expect(updated.groups.map((group) => group.name)).toEqual([
      'KIDT-231',
      'KIDT-232',
      'My group',
      'KIDT-233',
      'KIDT-234',
    ]);
    expect(new Set(updated.groups.map((group) => group.id)).size).toBe(5);
    expect(updated.lessons).toEqual(data.lessons);
    expect(migrateSchedule(updated)).toBe(updated);
    expect(parseData(JSON.stringify(updated))).toEqual(updated);
  });
  it('aligns only recognized starter times and preserves personal records and notes', () => {
    const data = createDemo();
    data.lessons[0] = {
      ...data.lessons[0],
      start: '09:00',
      end: '10:20',
      room: '999',
      note: 'Keep me',
    };
    const personal = { ...data.lessons[0], id: 'personal', day: 5 };
    data.lessons.push(personal);
    const updated = migrateSchedule(data);
    expect(updated.lessons[0]).toMatchObject({
      start: '08:30',
      end: '09:50',
      room: '999',
      note: 'Keep me',
    });
    expect(updated.lessons.at(-1)).toBe(personal);
    expect(migrateSchedule(updated)).toBe(updated);
  });
  it('does not introduce a collision when aligning an older starter time', () => {
    const data = createDemo();
    data.lessons = [
      { ...data.lessons[0], start: '09:00', end: '10:20' },
      { ...data.lessons[0], id: 'personal', start: '08:00', end: '08:40' },
    ];
    expect(parseData(JSON.stringify(data))).toEqual(data);
    expect(migrateSchedule(data)).toBe(data);
  });
  it('backs up original groups and times before updating browser storage', () => {
    const data = createDemo();
    data.groups = data.groups.slice(0, 2);
    data.groups[0].name = 'KI-21';
    data.lessons[0] = { ...data.lessons[0], start: '09:00', end: '10:20' };
    // Keep this fixture conflict-free before migration, as in the old starter schedule.
    data.lessons = [data.lessons[0]];
    const raw = JSON.stringify(data);
    const storage = new Map([[STORAGE_KEY, raw]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const result = loadData();
    expect(result.warning).toBe('');
    expect(result.data.lessons[0].start).toBe('08:30');
    expect(result.data.groups.map((group) => group.name)).toEqual([
      'KIDT-231',
      'KIDT-232',
      'KIDT-233',
      'KIDT-234',
    ]);
    expect(storage.get(`${STORAGE_KEY}-before-periods`)).toBe(raw);
    expect(loadData().data).toEqual(result.data);
  });
  it('replaces only recognized demo records while preserving personal changes', () => {
    const data = legacy();
    data.lessons[0].note = 'My notes';
    data.lessons[0].room = '999';
    data.subjects.push({
      id: 'custom',
      name: 'My course',
      teacherId: 't1',
      color: 'sage',
      code: 'CUSTOM',
    });
    const updated = migrateLegacy(data);
    expect(updated.lessons[0].note).toBe('My notes');
    expect(updated.lessons[0].room).toBe('999');
    expect(updated.subjects.at(-1)?.name).toBe('My course');
    expect(updated.teachers[0].name).toBe('Xusainov Shixnazar Madaminovich');
    expect(parseData(JSON.stringify(updated))).toEqual(updated);
    expect(migrateLegacy(updated)).toBe(updated);
  });
  it('keeps a backup of original storage before migrating', () => {
    const raw = JSON.stringify(legacy());
    const storage = new Map([[STORAGE_KEY, raw]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const result = loadData();
    expect(result.warning).toBe('');
    expect(storage.get(`${STORAGE_KEY}-before-urdu`)).toBe(raw);
    expect(storage.get(STORAGE_KEY)).toContain('Xusainov');
  });
});
