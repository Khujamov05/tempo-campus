import { describe, it, expect } from 'vitest';
import {
  createDemo,
  lessonsInWeek,
  applyException,
  parseData,
  exceptionConflicts,
  calendarExport,
  type LessonException,
} from './model';
const original = createDemo();
original.lessons = [
  {
    id: 'l1',
    subjectId: 's1',
    groupId: 'g1',
    day: 0,
    start: '08:30',
    end: '09:50',
    room: '301',
    type: 'Лекция',
    frequency: 'odd',
    note: '',
  },
];
const change: LessonException = {
  lessonId: 'l1',
  originalDate: '2027-01-04',
  date: '2027-01-12',
  start: '10:00',
  end: '11:20',
  room: '204',
  cancelled: false,
  reason: 'Meeting',
};
describe('dated timetable changes', () => {
  it('moves just one occurrence across weeks and exports it even in an even week', () => {
    const data = applyException(original, change);
    parseData(JSON.stringify(data));
    expect(lessonsInWeek(data, new Date('2027-01-04T12:00:00'))).toHaveLength(0);
    const moved = lessonsInWeek(data, new Date('2027-01-11T12:00:00'));
    expect(moved).toHaveLength(1);
    expect(moved[0].room).toBe('204');
    expect(calendarExport(moved, data, new Date('2027-01-11T12:00:00'))).toContain(
      'DTSTART:20270112T100000',
    );
    expect(lessonsInWeek(data, new Date('2027-01-18T12:00:00'))[0].room).toBe('301');
  });
  it('cancels one occurrence without removing its template', () => {
    const data = applyException(original, { ...change, cancelled: true });
    expect(lessonsInWeek(data, new Date('2027-01-04T12:00:00'))).toHaveLength(0);
    expect(data.lessons).toHaveLength(1);
  });
  it('rejects impossible source dates, duplicate overrides, and dated collisions', () => {
    expect(() =>
      parseData(
        JSON.stringify(applyException(original, { ...change, originalDate: '2027-02-30' })),
      ),
    ).toThrow();
    expect(() =>
      parseData(JSON.stringify({ ...original, exceptions: [change, change] })),
    ).toThrow();
    const busy = {
      ...original,
      lessons: [
        ...original.lessons,
        {
          ...original.lessons[0],
          id: 'l2',
          day: 1,
          frequency: 'every' as const,
          start: '10:00',
          end: '11:20',
        },
      ],
    };
    expect(exceptionConflicts(busy, change)).toContain('У группы уже есть занятие');
    expect(() => parseData(JSON.stringify(applyException(busy, change)))).toThrow();
  });
});
