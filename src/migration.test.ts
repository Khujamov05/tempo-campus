import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDemo,
  migrateLegacy,
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
