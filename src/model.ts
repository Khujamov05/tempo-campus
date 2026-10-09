export type Tone = 'sage' | 'lavender' | 'peach' | 'blue' | 'yellow' | 'rose';
export type Frequency = 'every' | 'odd' | 'even';
export type LessonType = 'Лекция' | 'Практика' | 'Семинар' | 'Лабораторная';
export interface Teacher {
  id: string;
  name: string;
  department: string;
}
export interface Subject {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  color: Tone;
}
export interface Group {
  id: string;
  name: string;
  description: string;
}
export interface Lesson {
  id: string;
  subjectId: string;
  groupId: string;
  day: number;
  start: string;
  end: string;
  room: string;
  type: LessonType;
  frequency: Frequency;
  note: string;
}
export interface Data {
  version: 1;
  subjects: Subject[];
  teachers: Teacher[];
  groups: Group[];
  lessons: Lesson[];
}
export const STORAGE_KEY = 'tempo-campus-v1';
export const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const SHORT_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const TONES: Tone[] = ['sage', 'lavender', 'peach', 'blue', 'yellow', 'rose'];
export const TYPES: LessonType[] = ['Лекция', 'Практика', 'Семинар', 'Лабораторная'];
export const FREQUENCIES: Record<Frequency, string> = {
  every: 'Каждую неделю',
  odd: 'Нечётные недели',
  even: 'Чётные недели',
};
export const uid = () => crypto.randomUUID();
export const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
export function monday(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
export function isoWeek(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  return Math.ceil(
    ((utc.getTime() - new Date(Date.UTC(utc.getUTCFullYear(), 0, 1)).getTime()) / 86400000 + 1) / 7,
  );
}
export const activeInWeek = (lesson: Lesson, date: Date) =>
  lesson.frequency === 'every' ||
  (isoWeek(date) % 2 === 0 ? lesson.frequency === 'even' : lesson.frequency === 'odd');
export const dateLabel = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', options).format(date);
export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
export const shortName = (name: string) => {
  const [last, ...rest] = name.split(' ');
  return `${last} ${rest.map((n) => `${n[0]}.`).join(' ')}`;
};
export function plural(n: number, words: [string, string, string]): string {
  const a = n % 100;
  const b = n % 10;
  return words[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
}

export function createDemo(): Data {
  const teachers: Teacher[] = [
    { id: 't1', name: 'Каримова Алина Рустамовна', department: 'Математика и анализ' },
    { id: 't2', name: 'Петров Максим Андреевич', department: 'Компьютерные науки' },
    { id: 't3', name: 'Юсупова Диана Алишеровна', department: 'Иностранные языки' },
    { id: 't4', name: 'Соколов Артём Ильич', department: 'Информационные системы' },
    { id: 't5', name: 'Мирзаев Тимур Олегович', department: 'Гуманитарные дисциплины' },
  ];
  const subjects: Subject[] = [
    { id: 's1', name: 'Высшая математика', code: 'MATH 201', teacherId: 't1', color: 'sage' },
    {
      id: 's2',
      name: 'Алгоритмы и структуры данных',
      code: 'CS 204',
      teacherId: 't2',
      color: 'lavender',
    },
    { id: 's3', name: 'Английский язык', code: 'ENG 202', teacherId: 't3', color: 'peach' },
    { id: 's4', name: 'Базы данных', code: 'CS 208', teacherId: 't4', color: 'blue' },
    { id: 's5', name: 'Философия', code: 'HUM 201', teacherId: 't5', color: 'yellow' },
    { id: 's6', name: 'Веб-разработка', code: 'CS 212', teacherId: 't2', color: 'rose' },
  ];
  const groups = [
    { id: 'g1', name: 'ИС-21', description: 'Информационные системы · 2 курс' },
    { id: 'g2', name: 'ПИ-22', description: 'Программная инженерия · 2 курс' },
  ];
  const slots: [string, number, string, string, string, LessonType][] = [
    ['s1', 0, '09:00', '10:20', '301', 'Лекция'],
    ['s2', 0, '10:40', '12:00', '204', 'Практика'],
    ['s3', 0, '13:00', '14:20', '112', 'Семинар'],
    ['s4', 1, '09:00', '10:20', '208', 'Лекция'],
    ['s1', 1, '10:40', '12:00', '301', 'Практика'],
    ['s5', 1, '14:40', '16:00', '405', 'Лекция'],
    ['s2', 2, '09:00', '10:20', '204', 'Лекция'],
    ['s6', 2, '10:40', '12:00', '206', 'Лабораторная'],
    ['s3', 2, '13:00', '14:20', '112', 'Практика'],
    ['s1', 3, '09:00', '10:20', '301', 'Практика'],
    ['s4', 3, '13:00', '14:20', '208', 'Лабораторная'],
    ['s5', 3, '14:40', '16:00', '405', 'Семинар'],
    ['s6', 4, '09:00', '10:20', '206', 'Практика'],
    ['s2', 4, '10:40', '12:00', '204', 'Лабораторная'],
    ['s3', 4, '13:00', '14:20', '112', 'Семинар'],
  ];
  const lessons: Lesson[] = slots.map(([subjectId, day, start, end, room, type], i) => ({
    id: `l${i}`,
    subjectId,
    groupId: 'g1',
    day,
    start,
    end,
    room,
    type,
    frequency: 'every',
    note: '',
  }));
  lessons.push(
    ...[
      {
        id: 'l20',
        subjectId: 's4',
        groupId: 'g2',
        day: 0,
        start: '09:00',
        end: '10:20',
        room: '208',
        type: 'Лекция' as const,
        frequency: 'every' as const,
        note: '',
      },
      {
        id: 'l21',
        subjectId: 's6',
        groupId: 'g2',
        day: 1,
        start: '10:40',
        end: '12:00',
        room: '206',
        type: 'Практика' as const,
        frequency: 'every' as const,
        note: '',
      },
      {
        id: 'l22',
        subjectId: 's1',
        groupId: 'g2',
        day: 2,
        start: '14:40',
        end: '16:00',
        room: '301',
        type: 'Лекция' as const,
        frequency: 'every' as const,
        note: '',
      },
      {
        id: 'l23',
        subjectId: 's3',
        groupId: 'g2',
        day: 3,
        start: '10:40',
        end: '12:00',
        room: '112',
        type: 'Практика' as const,
        frequency: 'every' as const,
        note: '',
      },
      {
        id: 'l24',
        subjectId: 's5',
        groupId: 'g2',
        day: 4,
        start: '14:40',
        end: '16:00',
        room: '405',
        type: 'Семинар' as const,
        frequency: 'every' as const,
        note: '',
      },
    ],
  );
  return { version: 1, teachers, subjects, groups, lessons };
}

const validTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const string = (value: unknown, max = 200): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function validateLesson(lesson: Lesson, data: Data): string | null {
  if (
    !data.subjects.some((s) => s.id === lesson.subjectId) ||
    !data.groups.some((g) => g.id === lesson.groupId)
  )
    return 'Выберите предмет и группу.';
  if (!Number.isInteger(lesson.day) || lesson.day < 0 || lesson.day > 5)
    return 'Выберите день с понедельника по субботу.';
  if (
    !validTime(lesson.start) ||
    !validTime(lesson.end) ||
    minutes(lesson.end) <= minutes(lesson.start)
  )
    return 'Окончание занятия должно быть позже начала.';
  if (minutes(lesson.start) < 480 || minutes(lesson.end) > 1200)
    return 'Занятия доступны с 08:00 до 20:00.';
  if (minutes(lesson.end) - minutes(lesson.start) < 30)
    return 'Минимальная длительность занятия — 30 минут.';
  if (!string(lesson.room, 60)) return 'Укажите аудиторию (до 60 символов).';
  if (
    !TYPES.includes(lesson.type) ||
    typeof lesson.frequency !== 'string' ||
    !Object.hasOwn(FREQUENCIES, lesson.frequency)
  )
    return 'Проверьте формат и периодичность занятия.';
  if (typeof lesson.note !== 'string' || lesson.note.length > 1000)
    return 'Заметка должна быть не длиннее 1000 символов.';
  const teacherId = data.subjects.find((s) => s.id === lesson.subjectId)?.teacherId;
  const collision = data.lessons.find(
    (other) =>
      other.id !== lesson.id &&
      other.day === lesson.day &&
      (other.frequency === 'every' ||
        lesson.frequency === 'every' ||
        other.frequency === lesson.frequency) &&
      minutes(lesson.start) < minutes(other.end) &&
      minutes(lesson.end) > minutes(other.start) &&
      (other.groupId === lesson.groupId ||
        other.room.trim().toLocaleLowerCase() === lesson.room.trim().toLocaleLowerCase() ||
        data.subjects.find((s) => s.id === other.subjectId)?.teacherId === teacherId),
  );
  if (!collision) return null;
  const subject = data.subjects.find((s) => s.id === collision.subjectId);
  const reason =
    collision.groupId === lesson.groupId
      ? 'У группы уже есть занятие'
      : collision.room.trim().toLocaleLowerCase() === lesson.room.trim().toLocaleLowerCase()
        ? 'Аудитория уже занята'
        : 'Преподаватель уже занят';
  return `${reason}: ${subject?.name}, ${collision.start}–${collision.end}.`;
}

export function parseData(raw: string): Data {
  if (raw.length > 2_000_000) throw new Error('Файл слишком большой. Максимум — 2 МБ.');
  let data: Data;
  try {
    data = JSON.parse(raw) as Data;
  } catch {
    throw new Error('Не удалось прочитать JSON. Выберите резервную копию Tempo.');
  }
  const fail = () => {
    throw new Error('Структура файла не поддерживается. Используйте резервную копию Tempo.');
  };
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.subjects) ||
    !Array.isArray(data.teachers) ||
    !Array.isArray(data.groups) ||
    !Array.isArray(data.lessons)
  )
    return fail();
  for (const list of [data.subjects, data.teachers, data.groups, data.lessons]) {
    if (
      list.length > 2000 ||
      list.some((item) => !item || !string(item.id, 100)) ||
      new Set(list.map((item) => item.id)).size !== list.length
    )
      return fail();
  }
  if (!data.groups.length || !data.subjects.length || !data.teachers.length) return fail();
  if (data.teachers.some((t) => !string(t.name, 100) || !string(t.department, 120))) return fail();
  if (data.groups.some((g) => !string(g.name, 60) || !string(g.description, 150))) return fail();
  if (
    data.subjects.some(
      (s) =>
        !string(s.name, 100) ||
        !string(s.code, 30) ||
        !TONES.includes(s.color) ||
        !data.teachers.some((t) => t.id === s.teacherId),
    )
  )
    return fail();
  for (const lesson of data.lessons) {
    const error = validateLesson(lesson, data);
    if (error) throw new Error(`Ошибка в расписании: ${error}`);
  }
  return data;
}

export function loadData(): { data: Data; warning: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { data: raw ? parseData(raw) : createDemo(), warning: '' };
  } catch {
    return {
      data: createDemo(),
      warning:
        'Сохранённые данные недоступны. Открыта демоверсия; исходная копия не перезаписана. Можно импортировать резервную копию в настройках.',
    };
  }
}

export function calendarExport(lessons: Lesson[], data: Data, week: Date): string {
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const stamp = (date: Date, time: string) =>
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}T${time.replace(':', '')}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tempo//Campus//RU',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Tempo',
  ];
  for (const lesson of lessons.filter((l) => activeInWeek(l, week))) {
    const day = addDays(week, lesson.day);
    const subject = data.subjects.find((s) => s.id === lesson.subjectId)!;
    const teacher = data.teachers.find((t) => t.id === subject.teacherId)!;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${lesson.id}-${stamp(day, lesson.start)}@tempo`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')}`,
      `DTSTART:${stamp(day, lesson.start)}`,
      `DTEND:${stamp(day, lesson.end)}`,
      `SUMMARY:${escape(subject.name)}`,
      `LOCATION:${escape(`Аудитория ${lesson.room}`)}`,
      `DESCRIPTION:${escape(`${lesson.type} · ${teacher.name}\n${lesson.note}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  // RFC 5545: fold at 75 UTF-8 octets without splitting a multibyte character.
  return (
    lines
      .map((line) => {
        let out = '';
        let bytes = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (bytes + size > 75) {
            out += '\r\n ';
            bytes = 1;
          }
          out += char;
          bytes += size;
        }
        return out;
      })
      .join('\r\n') + '\r\n'
  );
}

export function download(contents: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
