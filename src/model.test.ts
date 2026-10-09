import { describe, expect, it } from 'vitest';
import {
  activeInWeek,
  calendarExport,
  createDemo,
  isoWeek,
  monday,
  parseData,
  validateLesson,
  LESSON_PERIODS,
  isLessonPeriod,
  minutes,
  type Lesson,
} from './model';

const candidate = (overrides: Partial<Lesson> = {}): Lesson => ({
  id: 'new',
  subjectId: 's1',
  groupId: 'g1',
  day: 5,
  start: '09:00',
  end: '10:20',
  room: '301',
  type: 'Лекция',
  frequency: 'every',
  note: '',
  ...overrides,
});

describe('weekly schedule', () => {
  it('finds Monday across year boundaries without UTC offsets', () => {
    const date = monday(new Date(2027, 0, 3, 12));
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 11, 28]);
    expect(isoWeek(new Date(2027, 0, 3))).toBe(53);
    expect(isoWeek(new Date(2027, 0, 4))).toBe(1);
  });
  it('selects odd and even ISO weeks', () => {
    expect(activeInWeek(candidate({ frequency: 'odd' }), new Date(2027, 0, 4))).toBe(true);
    expect(activeInWeek(candidate({ frequency: 'even' }), new Date(2027, 0, 4))).toBe(false);
    expect(activeInWeek(candidate({ frequency: 'even' }), new Date(2027, 0, 11))).toBe(true);
  });
  it('has valid demo data with no collisions', () => {
    const demo = createDemo();
    for (const lesson of demo.lessons) expect(validateLesson(lesson, demo)).toBeNull();
    expect(parseData(JSON.stringify(demo))).toEqual(demo);
  });
  it('rejects a group collision even with a different room and teacher', () => {
    expect(
      validateLesson(candidate({ day: 0, subjectId: 's5', room: '900' }), createDemo()),
    ).toContain('У группы');
  });
  it('rejects a teacher collision across different subjects and groups', () => {
    expect(
      validateLesson(
        candidate({
          day: 0,
          subjectId: 's6',
          groupId: 'g2',
          start: '10:40',
          end: '12:00',
          room: '900',
        }),
        createDemo(),
      ),
    ).toContain('Преподаватель');
  });
  it('rejects a room collision across groups', () => {
    expect(
      validateLesson(
        candidate({
          day: 0,
          subjectId: 's5',
          groupId: 'g2',
          start: '10:40',
          end: '12:00',
          room: '204',
        }),
        createDemo(),
      ),
    ).toContain('Аудитория');
  });
  it('permits adjacent lessons and ignores itself when editing', () => {
    const data = createDemo();
    expect(validateLesson(candidate({ day: 0, start: '14:50', end: '15:30' }), data)).toBeNull();
    expect(validateLesson(data.lessons[0], data)).toBeNull();
  });
  it('allows alternating weeks but detects every-week collisions', () => {
    const data = createDemo();
    data.lessons = [candidate({ id: 'existing', frequency: 'odd' })];
    expect(validateLesson(candidate({ frequency: 'even' }), data)).toBeNull();
    expect(validateLesson(candidate({ frequency: 'every' }), data)).toContain('У группы');
  });
  it('validates durations, working hours and references', () => {
    expect(validateLesson(candidate({ end: '08:00' }), createDemo())).toContain('Окончание');
    expect(validateLesson(candidate({ end: '09:15' }), createDemo())).toContain('30 минут');
    expect(validateLesson(candidate({ start: '07:00' }), createDemo())).toContain('08:00');
    expect(validateLesson(candidate({ subjectId: 'missing' }), createDemo())).toContain('предмет');
  });
});

describe('class periods', () => {
  it('offers six 80-minute periods from 08:30, with the last starting at 16:30', () => {
    expect(LESSON_PERIODS).toHaveLength(6);
    expect(LESSON_PERIODS[0].start).toBe('08:30');
    expect(LESSON_PERIODS.at(-1)).toEqual({ start: '16:30', end: '17:50' });
    for (const period of LESSON_PERIODS) {
      expect(minutes(period.end) - minutes(period.start)).toBe(80);
    }
    const breaks = LESSON_PERIODS.slice(1).map(
      (period, index) => minutes(period.start) - minutes(LESSON_PERIODS[index].end),
    );
    expect(breaks).toEqual([10, 10, 40, 10, 10]);
    expect(LESSON_PERIODS[2].end).toBe('12:50');
  });
  it('requires an exact start/end pair and uses those periods in the starter schedule', () => {
    for (const period of LESSON_PERIODS) expect(isLessonPeriod(period)).toBe(true);
    expect(isLessonPeriod({ start: '08:30', end: '10:00' })).toBe(false);
    expect(isLessonPeriod({ start: '18:00', end: '19:20' })).toBe(false);
    expect(isLessonPeriod({ start: '09:00', end: '10:20' })).toBe(false);
    for (const lesson of createDemo().lessons) expect(isLessonPeriod(lesson)).toBe(true);
  });
  it('keeps older saved times readable without silently changing them', () => {
    const data = createDemo();
    data.lessons = [candidate()];
    expect(parseData(JSON.stringify(data)).lessons[0]).toEqual(candidate());
  });
});

describe('backups and calendar export', () => {
  it('rejects invalid JSON, references, duplicate IDs, and oversized input', () => {
    expect(() => parseData('not json')).toThrow('JSON');
    expect(() => parseData('{}')).toThrow('Структура');
    expect(() => parseData('x'.repeat(2_000_001))).toThrow('большой');
    const broken = createDemo();
    broken.lessons[0].subjectId = 'missing';
    expect(() => parseData(JSON.stringify(broken))).toThrow();
    const duplicate = createDemo();
    duplicate.teachers.push(duplicate.teachers[0]);
    expect(() => parseData(JSON.stringify(duplicate))).toThrow('Структура');
  });
  it('rejects imported conflicts before replacing data', () => {
    const data = createDemo();
    data.lessons.push({ ...data.lessons[0], id: 'duplicate-time' });
    expect(() => parseData(JSON.stringify(data))).toThrow('У группы');
  });
  it('exports the selected week in local time, escaping and folding Unicode safely', () => {
    const data = createDemo();
    const lesson = candidate({ note: 'Очень длинная заметка; с запятой, и переносом\n'.repeat(8) });
    const result = calendarExport([lesson], data, new Date(2026, 9, 5));
    const unfolded = result.replace(/\r\n /g, '');
    expect(unfolded).toContain('DTSTART:20261010T090000');
    expect(unfolded).toContain('DTEND:20261010T102000');
    expect(unfolded).toContain('заметка\\; с запятой\\, и переносом\\n');
    expect(unfolded).toContain('END:VCALENDAR');
    for (const line of result.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it('excludes lessons not active in the exported week', () => {
    const result = calendarExport(
      [candidate({ frequency: 'even' })],
      createDemo(),
      new Date(2027, 0, 4),
    );
    expect(result).not.toContain('BEGIN:VEVENT');
  });
});
