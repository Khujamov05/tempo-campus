import { translate, type Language } from './i18n-core';

export type Tone = 'sage' | 'lavender' | 'peach' | 'blue' | 'yellow' | 'rose';
export type Frequency = 'every' | 'odd' | 'even';
export type LessonType = 'Лекция' | 'Практика' | 'Семинар' | 'Лабораторная';
export interface Teacher {
  id: string;
  name: string;
  department: string;
  short?: string;
  source?: string;
}
export interface Subject {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  additionalTeacherIds?: string[];
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
  teacherId?: string;
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
export const LESSON_PERIODS = [
  { start: '08:30', end: '09:50' },
  { start: '10:00', end: '11:20' },
  { start: '11:30', end: '12:50' },
  { start: '13:30', end: '14:50' },
  { start: '15:00', end: '16:20' },
  { start: '16:30', end: '17:50' },
] as const;
export const isLessonPeriod = (lesson: Pick<Lesson, 'start' | 'end'>) =>
  LESSON_PERIODS.some((period) => period.start === lesson.start && period.end === lesson.end);
export function schedulePeriods(lessons: Lesson[]) {
  const rows: { start: string; end: string; number: number | null }[] = LESSON_PERIODS.map(
    (period, index) => ({ ...period, number: index + 1 }),
  );
  for (const lesson of lessons) {
    if (!rows.some((row) => row.start === lesson.start && row.end === lesson.end)) {
      rows.push({ start: lesson.start, end: lesson.end, number: null });
    }
  }
  return rows.sort(
    (a, b) => minutes(a.start) - minutes(b.start) || minutes(a.end) - minutes(b.end),
  );
}
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
  if (/\b[A-Z]{1,2}\./.test(name)) return name;
  const [last, ...rest] = name.split(' ');
  return `${last} ${rest
    .filter((n) => !/^(o['‘’]g['‘’]li|qizi)$/i.test(n))
    .map((n) => `${n.startsWith('Sh') ? 'Sh' : n[0]}.`)
    .join(' ')}`;
};
export const subjectTeachers = (subject: Subject, data: Data) =>
  [subject.teacherId, ...(subject.additionalTeacherIds ?? [])]
    .map((id) => data.teachers.find((teacher) => teacher.id === id))
    .filter((teacher): teacher is Teacher => Boolean(teacher));
export const lessonTeacher = (lesson: Lesson, data: Data) =>
  data.teachers.find(
    (teacher) =>
      teacher.id ===
      (lesson.teacherId ??
        data.subjects.find((subject) => subject.id === lesson.subjectId)?.teacherId),
  );
export function plural(n: number, words: [string, string, string]): string {
  const a = n % 100;
  const b = n % 10;
  return words[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
}

export function createDemo(): Data {
  const cs = "Kompyuter ilmlari va sun'iy intellekt texnologiyalari";
  const csSource = 'https://urdu.uz/uz/site/departmentviewemployee?id=26';
  const ceSource = 'https://urdu.uz/uz/site/departmentviewemployee?id=113';
  const teachers: Teacher[] = [
    {
      id: 't1',
      name: 'Xusainov Shixnazar Madaminovich',
      short: 'Xusainov Sh. M.',
      department: cs,
      source: csSource,
    },
    {
      id: 't6',
      name: "Yuldashov Ollabergan Ergash o'g'li",
      short: 'Yuldashov O. E.',
      department: cs,
      source: csSource,
    },
    {
      id: 't2',
      name: 'Shermatov B. I.',
      short: 'Shermatov B. I.',
      department: cs,
      source: 'https://urdu.uz/uz/site/view-fan?id=4',
    },
    {
      id: 't3',
      name: 'Sattarova Sapura Beknazarovna',
      short: 'Sattarova S. B.',
      department: cs,
      source: csSource,
    },
    {
      id: 't4',
      name: "Quriyozov Elmurod Rajabboy o'g'li",
      short: 'Quriyozov E. R.',
      department: cs,
      source: csSource,
    },
    { id: 't5', name: 'Ruzmetov O. A.', department: 'Tadbirkorlik asoslari' },
    {
      id: 't7',
      name: "Xo'jayev Otabek Kadambayevich",
      department: 'Kompyuter injiniringi',
      source: ceSource,
    },
    {
      id: 't8',
      name: 'Yusupova Shohida Botirboyevna',
      department: 'Kompyuter injiniringi',
      source: ceSource,
    },
  ];
  const subjects: Subject[] = [
    {
      id: 's1',
      name: 'Loyihalarni boshqarish',
      code: 'LB',
      teacherId: 't1',
      additionalTeacherIds: ['t6'],
      color: 'sage',
    },
    {
      id: 's2',
      name: 'Data mining va berilganlar tahlili',
      code: 'DM',
      teacherId: 't2',
      color: 'lavender',
    },
    {
      id: 's3',
      name: "Informatikani o'qitish metodikasi",
      code: 'IOM',
      teacherId: 't3',
      color: 'peach',
    },
    {
      id: 's4',
      name: "Sun'iy intellekt texnologiyalari",
      code: 'SI',
      teacherId: 't4',
      color: 'blue',
    },
    { id: 's5', name: 'Tadbirkorlik asoslari', code: 'TA', teacherId: 't5', color: 'yellow' },
    {
      id: 's6',
      name: 'Java dasturlash tili asoslari',
      code: 'JAVA',
      teacherId: 't2',
      additionalTeacherIds: ['t4'],
      color: 'rose',
    },
  ];
  const groups = [
    { id: 'g1', name: 'KIDT-231', description: 'Kompyuter injiniringi' },
    { id: 'g2', name: 'KIDT-232', description: 'Kompyuter injiniringi' },
    { id: 'g3', name: 'KIDT-233', description: 'Kompyuter injiniringi' },
    { id: 'g4', name: 'KIDT-234', description: 'Kompyuter injiniringi' },
  ];
  const slots: [string, number, string, string, string, LessonType][] = [
    ['s1', 0, '08:30', '09:50', '301', 'Лекция'],
    ['s2', 0, '10:00', '11:20', '204', 'Практика'],
    ['s3', 0, '13:30', '14:50', '112', 'Семинар'],
    ['s4', 1, '08:30', '09:50', '208', 'Лекция'],
    ['s1', 1, '10:00', '11:20', '301', 'Практика'],
    ['s5', 1, '15:00', '16:20', '405', 'Лекция'],
    ['s2', 2, '08:30', '09:50', '204', 'Лекция'],
    ['s6', 2, '10:00', '11:20', '206', 'Лабораторная'],
    ['s3', 2, '13:30', '14:50', '112', 'Практика'],
    ['s1', 3, '08:30', '09:50', '301', 'Практика'],
    ['s4', 3, '13:30', '14:50', '208', 'Лабораторная'],
    ['s5', 3, '15:00', '16:20', '405', 'Семинар'],
    ['s6', 4, '08:30', '09:50', '206', 'Практика'],
    ['s2', 4, '10:00', '11:20', '204', 'Лабораторная'],
    ['s3', 4, '13:30', '14:50', '112', 'Семинар'],
  ];
  const lessons: Lesson[] = slots.map(([subjectId, day, start, end, room, type], i) => ({
    id: `l${i}`,
    subjectId,
    ...(subjectId === 's1' && type !== 'Лекция' ? { teacherId: 't6' } : {}),
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
        start: '08:30',
        end: '09:50',
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
        start: '10:00',
        end: '11:20',
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
        start: '15:00',
        end: '16:20',
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
        start: '10:00',
        end: '11:20',
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
        start: '15:00',
        end: '16:20',
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
  if (lesson.teacherId && !data.teachers.some((teacher) => teacher.id === lesson.teacherId))
    return 'Выберите преподавателя из справочника.';
  const teacherId = lessonTeacher(lesson, data)?.id;
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
        (teacherId && lessonTeacher(other, data)?.id === teacherId)),
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
  if (
    data.teachers.some(
      (t) =>
        !string(t.name, 100) ||
        !string(t.department, 120) ||
        (t.short !== undefined && !string(t.short, 60)) ||
        (t.source !== undefined &&
          (typeof t.source !== 'string' || !/^https:\/\/(www\.)?urdu\.uz\//.test(t.source))),
    )
  )
    return fail();
  if (data.groups.some((g) => !string(g.name, 60) || !string(g.description, 150))) return fail();
  if (
    data.subjects.some(
      (s) =>
        !string(s.name, 100) ||
        !string(s.code, 30) ||
        !TONES.includes(s.color) ||
        (s.teacherId !== '' && !data.teachers.some((t) => t.id === s.teacherId)) ||
        (s.additionalTeacherIds !== undefined &&
          (!Array.isArray(s.additionalTeacherIds) ||
            s.additionalTeacherIds.some((id) => !data.teachers.some((t) => t.id === id)))),
    )
  )
    return fail();
  for (const lesson of data.lessons) {
    if (lesson.teacherId !== undefined && typeof lesson.teacherId !== 'string') return fail();
    const error = validateLesson(lesson, data);
    if (error) throw new Error(`Ошибка в расписании: ${error}`);
  }
  return data;
}

export function migrateLegacy(data: Data): Data {
  const previousNames: Record<string, string> = {
    t1: 'Каримова Алина Рустамовна',
    t2: 'Петров Максим Андреевич',
    t3: 'Юсупова Диана Алишеровна',
    t4: 'Соколов Артём Ильич',
    t5: 'Мирзаев Тимур Олегович',
  };
  if (!data.teachers.some((teacher) => previousNames[teacher.id] === teacher.name)) return data;
  const next = createDemo();
  const previousSubjects: Record<string, string> = {
    s1: 'Высшая математика',
    s2: 'Алгоритмы и структуры данных',
    s3: 'Английский язык',
    s4: 'Базы данных',
    s5: 'Философия',
    s6: 'Веб-разработка',
  };
  const updatedSubjects = new Set(
    data.subjects
      .filter((subject) => previousSubjects[subject.id] === subject.name)
      .map((subject) => subject.id),
  );
  return {
    ...data,
    teachers: [
      ...data.teachers.map((teacher) =>
        previousNames[teacher.id] === teacher.name
          ? next.teachers.find((candidate) => candidate.id === teacher.id)!
          : teacher,
      ),
      ...next.teachers.filter(
        (teacher) => !data.teachers.some((existing) => existing.id === teacher.id),
      ),
    ],
    subjects: data.subjects.map((subject) =>
      updatedSubjects.has(subject.id)
        ? next.subjects.find((candidate) => candidate.id === subject.id)!
        : subject,
    ),
    groups: data.groups.map((group) =>
      (group.id === 'g1' && group.name === 'ИС-21') || (group.id === 'g2' && group.name === 'ПИ-22')
        ? next.groups.find((candidate) => candidate.id === group.id)!
        : group,
    ),
    lessons: data.lessons.map((lesson) =>
      updatedSubjects.has('s1') &&
      lesson.subjectId === 's1' &&
      lesson.teacherId === undefined &&
      lesson.type !== 'Лекция'
        ? { ...lesson, teacherId: 't6' }
        : lesson,
    ),
  };
}

export function migrateSchedule(data: Data): Data {
  const demo = createDemo();
  const oldGroups: Record<string, string[]> = { g1: ['KI-21', 'ИС-21'], g2: ['KI-22', 'ПИ-22'] };
  const groups = data.groups.map((group) =>
    oldGroups[group.id]?.includes(group.name)
      ? { ...group, name: demo.groups.find((candidate) => candidate.id === group.id)!.name }
      : group,
  );
  for (const group of demo.groups) {
    if (!groups.some((existing) => existing.name === group.name)) {
      groups.push({
        ...group,
        id: groups.some((existing) => existing.id === group.id) ? uid() : group.id,
      });
    }
  }
  const oldTimes: Record<string, string> = {
    '08:30': '09:00–10:20',
    '10:00': '10:40–12:00',
    '13:30': '13:00–14:20',
    '15:00': '14:40–16:00',
  };
  let lessons = data.lessons.map((lesson) => {
    const original = demo.lessons.find(
      (candidate) =>
        candidate.id === lesson.id &&
        candidate.subjectId === lesson.subjectId &&
        candidate.groupId === lesson.groupId &&
        candidate.day === lesson.day,
    );
    return original && oldTimes[original.start] === `${lesson.start}–${lesson.end}`
      ? { ...lesson, start: original.start, end: original.end }
      : lesson;
  });
  // Leave times intact if updating starter records would conflict with a personal lesson.
  const candidate = { ...data, groups, lessons };
  if (lessons.some((lesson) => validateLesson(lesson, candidate))) lessons = data.lessons;
  if (
    groups.length === data.groups.length &&
    groups.every((group, i) => group === data.groups[i]) &&
    lessons.every((lesson, i) => lesson === data.lessons[i])
  )
    return data;
  return { ...data, groups, lessons };
}

export function loadData(): { data: Data; warning: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: createDemo(), warning: '' };
    const previous = parseData(raw);
    const legacy = migrateLegacy(previous);
    const data = migrateSchedule(legacy);
    if (data !== previous) {
      try {
        // Retain the original before updating only the recognized starter records.
        const backupKey = `${STORAGE_KEY}-before-urdu`;
        if (legacy !== previous && !localStorage.getItem(backupKey))
          localStorage.setItem(backupKey, raw);
        if (data !== legacy && !localStorage.getItem(`${STORAGE_KEY}-before-periods`)) {
          localStorage.setItem(`${STORAGE_KEY}-before-periods`, raw);
        }
        parseData(JSON.stringify(data));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        return {
          data,
          warning:
            'Не удалось сохранить изменения в браузере. Скачайте резервную копию в настройках, чтобы не потерять данные.',
        };
      }
    }
    return { data, warning: '' };
  } catch {
    return {
      data: createDemo(),
      warning:
        'Сохранённые данные недоступны. Открыта демоверсия; исходная копия не перезаписана. Можно импортировать резервную копию в настройках.',
    };
  }
}

export function calendarExport(
  lessons: Lesson[],
  data: Data,
  week: Date,
  language: Language = 'uz',
): string {
  const t = (key: string) => translate(language, key);
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const stamp = (date: Date, time: string) =>
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}T${time.replace(':', '')}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Tempo//Campus//${language.toUpperCase()}`,
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Tempo',
  ];
  for (const lesson of lessons.filter((l) => activeInWeek(l, week))) {
    const day = addDays(week, lesson.day);
    const subject = data.subjects.find((s) => s.id === lesson.subjectId)!;
    const teacher = lessonTeacher(lesson, data);
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
      `LOCATION:${escape(`${t('Аудитория')} ${lesson.room}`)}`,
      `DESCRIPTION:${escape(`${t(lesson.type)} · ${teacher?.name ?? t('Преподаватель не указан')}\n${lesson.note}`)}`,
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
