import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coffee,
  Download,
  GraduationCap,
  LayoutGrid,
  List,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import {
  DAYS,
  SHORT_DAYS,
  TONES,
  TYPES,
  FREQUENCIES,
  LESSON_PERIODS,
  isLessonPeriod,
  schedulePeriods,
  STORAGE_KEY,
  activeInWeek,
  addDays,
  calendarExport,
  createDemo,
  download,
  initials,
  isoWeek,
  loadData,
  minutes,
  monday,
  parseData,
  shortName,
  subjectTeachers,
  lessonTeacher,
  uid,
  validateLesson,
  type Data,
  type Frequency,
  type Lesson,
  type LessonType,
  type Subject,
  type Teacher,
  type Tone,
} from './model';

import { useI18n, languageNames, type Language } from './i18n';

type Page = 'schedule' | 'subjects' | 'teachers' | 'settings';
type ModalState =
  | { type: 'lesson'; lesson?: Lesson; slot?: Pick<Lesson, 'day' | 'start' | 'end'> }
  | { type: 'subject' }
  | { type: 'teacher' }
  | { type: 'group' }
  | { type: 'help' }
  | { type: 'import'; data: Data }
  | { type: 'reset' }
  | null;
const PAGES: Record<Page, string> = {
  schedule: 'Расписание',
  subjects: 'Предметы',
  teachers: 'Преподаватели',
  settings: 'Настройки',
};

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">{t('ТВОЁ ПРОСТРАНСТВО')}</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={t('Закрыть окно')}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function LessonForm({
  lesson,
  slot,
  data,
  groupId,
  onSave,
  onDelete,
  onClose,
}: {
  lesson?: Lesson;
  slot?: Pick<Lesson, 'day' | 'start' | 'end'>;
  data: Data;
  groupId: string;
  onSave: (lesson: Lesson) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const translateType = t;

  const [draft, setDraft] = useState<Lesson>(
    lesson ?? {
      id: uid(),
      subjectId: data.subjects[0].id,
      groupId,
      day: (new Date().getDay() + 6) % 7 > 5 ? 0 : (new Date().getDay() + 6) % 7,
      ...LESSON_PERIODS[0],
      room: '',
      type: 'Лекция',
      frequency: 'every',
      note: '',
      ...slot,
    },
  );
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  function set<K extends keyof Lesson>(key: K, value: Lesson[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = { ...draft, room: draft.room.trim(), note: draft.note.trim() };
    if (!isLessonPeriod(clean)) {
      setError('Выберите пару из списка.');
      return;
    }
    const issue = validateLesson(clean, data);
    if (issue) {
      setError(issue);
      return;
    }
    onSave(clean);
  }
  return (
    <Modal
      title={lesson ? t('Детали занятия') : t('Новое занятие')}
      subtitle={t('Немного порядка для продуктивной недели.')}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label>
          {t('Предмет')}{' '}
          <select
            value={draft.subjectId}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                subjectId: e.target.value,
                teacherId: undefined,
              }))
            }
          >
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            {t('Группа')}{' '}
            <select value={draft.groupId} onChange={(e) => set('groupId', e.target.value)}>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Формат')}{' '}
            <select value={draft.type} onChange={(e) => set('type', e.target.value as LessonType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {translateType(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('День недели')}{' '}
            <select value={draft.day} onChange={(e) => set('day', Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {t(d)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Повторение')}{' '}
            <select
              value={draft.frequency}
              onChange={(e) => set('frequency', e.target.value as Frequency)}
            >
              {Object.entries(FREQUENCIES).map(([key, value]) => (
                <option key={key} value={key}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="period-picker" aria-describedby="period-hint">
          <legend>{t('Время пары')}</legend>
          <p id="period-hint" className="period-hint">
            {t('80 минут · между парами 10 минут')}
          </p>
          {lesson && !isLessonPeriod(draft) && (
            <p className="period-previous">
              {t('Сохранённое время: {start}–{end}. Выберите пару из списка.', {
                start: draft.start,
                end: draft.end,
              })}
            </p>
          )}
          <div className="period-grid">
            {LESSON_PERIODS.map((period, index) => (
              <label className="period-option" key={period.start}>
                <input
                  type="radio"
                  name="lesson-period"
                  value={period.start}
                  required
                  checked={draft.start === period.start && draft.end === period.end}
                  onChange={() => {
                    setDraft((current) => ({ ...current, ...period }));
                    setError('');
                  }}
                />
                <span className="period-card">
                  <span className="period-number">{t('Пара {number}', { number: index + 1 })}</span>
                  <strong>
                    {period.start}–{period.end}
                  </strong>
                  <Check className="period-check" size={14} aria-hidden="true" />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          {t('Аудитория')}{' '}
          <input
            required
            maxLength={60}
            placeholder={t('Например, 301')}
            value={draft.room}
            onChange={(e) => set('room', e.target.value)}
          />
        </label>
        <label>
          {t('Заметка')} <span className="optional">{t('необязательно')}</span>
          <textarea
            rows={2}
            maxLength={1000}
            placeholder={t('Что подготовить к занятию?')}
            value={draft.note}
            onChange={(e) => set('note', e.target.value)}
          />
        </label>
        <label>
          {t('Ответственный преподаватель')}
          <select
            value={draft.teacherId ?? ''}
            onChange={(event) =>
              setDraft((current) => ({ ...current, teacherId: event.target.value || undefined }))
            }
          >
            <option value="">{t('По умолчанию для предмета')}</option>
            {data.teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-hint">
          <UsersRound size={16} />
          <span>{lessonTeacher(draft, data)?.name ?? t('Преподаватель не указан')}</span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        )}
        {deleting && (
          <div className="delete-confirm">
            <p>{t('Удалить это занятие из всех недель?')}</p>
            <button type="button" className="danger-button" onClick={() => onDelete(draft.id)}>
              {t('Да, удалить занятие')}{' '}
            </button>
            <button type="button" className="text-button" onClick={() => setDeleting(false)}>
              {t('Отмена')}{' '}
            </button>
          </div>
        )}
        <div className="modal-actions">
          {lesson && (
            <button
              type="button"
              className="icon-button delete-button"
              aria-label={t('Удалить занятие')}
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose}>
            {t('Отмена')}{' '}
          </button>
          <button className="button primary" type="submit">
            <Check size={17} />
            {lesson ? t('Сохранить изменения') : t('Добавить занятие')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DirectoryForm({
  type,
  data,
  onSave,
  onClose,
}: {
  type: 'subject' | 'teacher' | 'group';
  data: Data;
  onSave: (data: Data) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const [color, setColor] = useState<Tone>('sage');
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name') ?? '').trim();
    const detail = String(fields.get('detail') ?? '').trim();
    if (!name || !detail) {
      setError('Заполните все поля.');
      return;
    }
    const collection =
      type === 'subject' ? data.subjects : type === 'teacher' ? data.teachers : data.groups;
    if (collection.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError('Такое название уже существует.');
      return;
    }
    if (type === 'subject')
      onSave({
        ...data,
        subjects: [
          ...data.subjects,
          { id: uid(), name, code: detail, teacherId: String(fields.get('teacher')), color },
        ],
      });
    else if (type === 'teacher')
      onSave({ ...data, teachers: [...data.teachers, { id: uid(), name, department: detail }] });
    else onSave({ ...data, groups: [...data.groups, { id: uid(), name, description: detail }] });
  }
  return (
    <Modal
      title={
        type === 'subject'
          ? t('Новый предмет')
          : type === 'teacher'
            ? t('Новый преподаватель')
            : t('Новая группа')
      }
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <label>
          {type === 'teacher' ? t('Фамилия, имя и отчество') : t('Название')}
          <input
            name="name"
            required
            maxLength={type === 'group' ? 60 : 100}
            placeholder={
              type === 'subject'
                ? t('Например, Дискретная математика')
                : type === 'teacher'
                  ? t('Введите полное имя')
                  : t('Например, KIDT-235')
            }
          />
        </label>
        <label>
          {type === 'subject'
            ? t('Код предмета')
            : type === 'teacher'
              ? t('Кафедра')
              : t('Направление и курс')}
          <input
            name="detail"
            required
            maxLength={type === 'subject' ? 30 : type === 'teacher' ? 120 : 150}
            placeholder={
              type === 'subject'
                ? 'MATH 205'
                : type === 'teacher'
                  ? t('Компьютерные науки')
                  : t('Информационные системы · 2 курс')
            }
          />
        </label>
        {type === 'subject' && (
          <>
            <label>
              {t('Преподаватель')}{' '}
              <select name="teacher">
                {data.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="color-field">
              <legend>{t('Цвет в расписании')}</legend>
              {TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  className={`color-option ${tone} ${color === tone ? 'selected' : ''}`}
                  aria-label={t('Цвет {color}', { color: tone })}
                  aria-pressed={color === tone}
                  onClick={() => setColor(tone)}
                >
                  {color === tone && <Check size={18} />}
                </button>
              ))}
            </fieldset>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            {t('Отмена')}{' '}
          </button>
          <button type="submit" className="button primary">
            <Plus size={17} />
            {t('Добавить')}{' '}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LessonCard({
  lesson,
  subject,
  teacher,
  onClick,
  compact = false,
}: {
  lesson: Lesson;
  subject: Subject;
  teacher?: Teacher;
  onClick: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();

  return (
    <button
      className={`lesson-card ${subject.color} ${compact ? 'compact' : ''}`}
      onClick={onClick}
      aria-label={`${subject.name}, ${t(DAYS[lesson.day])}, ${lesson.start}–${lesson.end}, ${t('Аудитория')} ${lesson.room}`}
    >
      <div className="lesson-meta">
        <span className="lesson-type" title={t(lesson.type)}>
          {lesson.type === 'Лабораторная' ? t('Лаб.') : t(lesson.type)}
        </span>
      </div>
      <h3>{subject.name}</h3>
      <div className="lesson-details">
        <span>
          <MapPin size={12} />
          {lesson.room}
        </span>
        <span className="teacher-short">
          {teacher ? (teacher.short ?? shortName(teacher.name)) : t('Преподаватель не указан')}
        </span>
      </div>
      {!compact && lesson.note && <div className="lesson-note">{lesson.note}</div>}
    </button>
  );
}

function PeriodLabel({ period }: { period: ReturnType<typeof schedulePeriods>[number] }) {
  const { t } = useI18n();
  return (
    <div className="period-label">
      <strong>
        {period.number === null ? t('Другое время') : t('Пара {number}', { number: period.number })}
      </strong>
      <span>
        {period.start}–{period.end}
      </span>
    </div>
  );
}

function SubjectPicker({
  subjects,
  value,
  onChange,
}: {
  subjects: Subject[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="subject-selector">
      <BookOpen size={16} aria-hidden="true" />
      <select
        aria-label={t('Выбор предмета')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">{t('Все предметы')}</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function App() {
  const { t, language, setLanguage, plural, dateLabel } = useI18n();

  const [initial] = useState(loadData);
  const [data, setData] = useState(initial.data);
  const [warning, setWarning] = useState(initial.warning);
  const [page, setPage] = useState<Page>('schedule');
  const [week, setWeek] = useState(() => monday(new Date()));
  const [groupId, setGroupId] = useState(data.groups[0].id);
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'week' | 'list'>('week');
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [undo, setUndo] = useState<Lesson | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast('');
      setUndo(null);
    }, 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  function notify(message: string) {
    setUndo(null);
    setToast(message);
  }
  function persist(next: Data) {
    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setWarning('');
    } catch {
      setWarning(
        'Не удалось сохранить изменения в браузере. Скачайте резервную копию в настройках, чтобы не потерять данные.',
      );
    }
  }
  function navigate(next: Page) {
    setPage(next);
    setQuery('');
    setSubjectFilter('all');
    setTeacherFilter('');
    setFilter('all');
    setMobileNav(false);
  }
  function saveLesson(lesson: Lesson) {
    const exists = data.lessons.some((l) => l.id === lesson.id);
    persist({
      ...data,
      lessons: exists
        ? data.lessons.map((l) => (l.id === lesson.id ? lesson : l))
        : [...data.lessons, lesson],
    });
    setModal(null);
    notify(exists ? 'Изменения сохранены' : 'Занятие добавлено в расписание');
  }
  function deleteLesson(id: string) {
    const removed = data.lessons.find((l) => l.id === id)!;
    persist({ ...data, lessons: data.lessons.filter((l) => l.id !== id) });
    setModal(null);
    setUndo(removed);
    setToast('Занятие удалено');
  }
  const group = data.groups.find((g) => g.id === groupId) ?? data.groups[0];
  const weekLessons = data.lessons.filter((l) => l.groupId === group.id && activeInWeek(l, week));
  const search = query.trim().toLocaleLowerCase();
  const hasScheduleFilters = subjectFilter !== 'all' || teacherFilter !== '' || filter !== 'all';
  const visible = weekLessons
    .filter(
      (l) =>
        (filter === 'all' || l.type === filter) &&
        (subjectFilter === 'all' || l.subjectId === subjectFilter) &&
        (!teacherFilter || lessonTeacher(l, data)?.id === teacherFilter),
    )
    .sort((a, b) => a.day - b.day || minutes(a.start) - minutes(b.start));
  const totalMinutes = weekLessons.reduce((sum, l) => sum + minutes(l.end) - minutes(l.start), 0);
  const subjectCount = new Set(weekLessons.map((l) => l.subjectId)).size;
  const freeDays = 6 - new Set(weekLessons.map((l) => l.day)).size;
  const isCurrent = monday(clock).getTime() === week.getTime();
  const dayIndex = (clock.getDay() + 6) % 7;
  const timeNow = clock.getHours() * 60 + clock.getMinutes();
  const todayLessons = weekLessons.filter((l) => l.day === dayIndex);
  const nextLesson = isCurrent
    ? todayLessons
        .filter((l) => minutes(l.end) > timeNow)
        .sort((a, b) => minutes(a.start) - minutes(b.start))[0]
    : undefined;
  const periods = schedulePeriods(visible);
  function exportCalendar() {
    download(
      calendarExport(visible, data, week, language),
      `tempo-${group.name}-${dateLabel(week, { year: 'numeric', month: '2-digit', day: '2-digit' })}.ics`,
      'text/calendar;charset=utf-8',
    );
    notify('Календарь выбранных занятий скачан');
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error(t('Файл слишком большой. Максимум — 2 МБ.'));
      setModal({ type: 'import', data: parseData(await file.text()) });
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось импортировать файл');
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label={t('Закрыть меню')}
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('schedule');
          }}
        >
          <span className="brand-mark">
            t<span>•</span>
          </span>
          <span>
            tempo<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">
            <GraduationCap size={19} />
          </span>
          <div>
            <strong>Khujamov E.</strong>
            <span>{t('Автор проекта')}</span>
          </div>
        </div>
        <div className="nav-caption">{t('ОРГАНИЗУЙ СВОЙ ДЕНЬ')}</div>
        <nav aria-label={t('Основная навигация')}>
          {(
            [
              { id: 'schedule', icon: CalendarDays },
              { id: 'subjects', icon: BookOpen },
              { id: 'teachers', icon: UsersRound },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              <item.icon size={19} />
              <span>{t(PAGES[item.id])}</span>
              {item.id === 'subjects' && <span className="nav-count">{data.subjects.length}</span>}
              {item.id === 'schedule' && page === 'schedule' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="orbit-art">
              <span />
              <span />
              <i>
                <Sparkles size={20} />
              </i>
            </div>
            <h3>{t('Поймай свой ритм.')}</h3>
            <p>
              {t('Когда всё на своих местах,')} <br />
              {t('остаётся время на главное.')}{' '}
            </p>
            <button onClick={() => setModal({ type: 'help' })}>
              {t('Знакомство с Tempo')} <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Settings2 size={19} />
            <span>{t('Настройки')}</span>
          </button>
          <div className="sidebar-footer">
            <span className="online-dot" />
            {t('В твоём ритме')}
            <span>v1.0</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label={t('Открыть меню')}
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <span>{t('Мой кампус')}</span>
            <ChevronRight size={13} />
            <strong>{t(PAGES[page])}</strong>
          </div>
          <div className="topbar-right">
            <select
              className="language-select"
              aria-label={t('Язык интерфейса')}
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              {(Object.keys(languageNames) as Language[]).map((code) => (
                <option key={code} value={code}>
                  {languageNames[code]}
                </option>
              ))}
            </select>
            <span className="today-date">
              {dateLabel(clock, { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="top-divider" />
            <button
              className="icon-button help-button"
              aria-label={t('Помощь')}
              onClick={() => setModal({ type: 'help' })}
            >
              <CircleHelp size={19} />
            </button>
            <span className="profile-avatar" title={t('Личное пространство')}>
              T
            </span>
          </div>
        </header>
        <main>
          {warning && (
            <div className="warning" role="alert">
              {t(warning)}
            </div>
          )}
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-dot" />{' '}
                {page === 'schedule' ? t('МЕНЬШЕ ХАОСА. БОЛЬШЕ ФОКУСА.') : t('ВСЁ В ОДНОМ МЕСТЕ')}
              </div>
              <h1>
                {page === 'schedule' ? t('Твоя неделя в порядке') : t(PAGES[page])}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === 'schedule'
                  ? t('Учись, планируй и находи время для себя.')
                  : page === 'subjects'
                    ? t('Все дисциплины и их место в твоём расписании.')
                    : page === 'teachers'
                      ? t('Те, кто помогает двигаться вперёд.')
                      : t('Твоё пространство работает по твоим правилам.')}
              </p>
            </div>
            {page === 'schedule' ? (
              <button
                className="button primary add-main"
                onClick={() => setModal({ type: 'lesson' })}
              >
                <Plus size={18} />
                {t('Добавить занятие')}{' '}
              </button>
            ) : page === 'subjects' || page === 'teachers' ? (
              <button
                className="button primary"
                onClick={() => setModal({ type: page === 'subjects' ? 'subject' : 'teacher' })}
              >
                <Plus size={18} />
                {page === 'subjects' ? t('Добавить предмет') : t('Добавить преподавателя')}
              </button>
            ) : (
              <div className="privacy-badge">
                <span className="online-dot" />
                {t('Локальное пространство')}{' '}
              </div>
            )}
          </section>

          {page === 'schedule' && (
            <>
              <section className="stats" aria-label={t('Обзор недели')}>
                <div className="stat-card">
                  <span className="stat-icon sage">
                    <CalendarDays size={20} />
                  </span>
                  <div>
                    <span className="stat-label">{t('На этой неделе')}</span>
                    <strong>
                      {weekLessons.length}
                      <small>{plural(weekLessons.length, ['занятие', 'занятия', 'занятий'])}</small>
                    </strong>
                  </div>
                  <span className="stat-decoration">↗</span>
                </div>
                <div className="stat-card">
                  <span className="stat-icon lavender">
                    <Clock3 size={20} />
                  </span>
                  <div>
                    <span className="stat-label">{t('Время учиться')}</span>
                    <strong>
                      {Math.round((totalMinutes / 60) * 10) / 10}
                      <small>{t('часов')}</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon peach">
                    <BookOpen size={20} />
                  </span>
                  <div>
                    <span className="stat-label">{t('В фокусе')}</span>
                    <strong>
                      {subjectCount}
                      <small>{plural(subjectCount, ['предмет', 'предмета', 'предметов'])}</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card free-stat">
                  <span className="stat-icon">
                    <Coffee size={20} />
                  </span>
                  <div>
                    <span className="stat-label">{t('Время для себя')}</span>
                    <strong>
                      {freeDays}
                      <small>
                        {plural(freeDays, ['свободный день', 'свободных дня', 'свободных дней'])}
                      </small>
                    </strong>
                  </div>
                </div>
              </section>

              <section className="schedule-panel" aria-label={t('Расписание занятий')}>
                <div className="schedule-toolbar">
                  <div className="week-navigation">
                    <h2>
                      {dateLabel(week, {
                        day: 'numeric',
                        ...(week.getMonth() !== addDays(week, 5).getMonth()
                          ? { month: 'short' as const }
                          : {}),
                      })}
                      –{dateLabel(addDays(week, 5), { day: 'numeric', month: 'long' })}
                      <span className="week-year">{week.getFullYear()}</span>
                    </h2>
                    <div className="week-arrows">
                      <button
                        className="icon-button"
                        aria-label={t('Предыдущая неделя')}
                        onClick={() => setWeek(addDays(week, -7))}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={t('Следующая неделя')}
                        onClick={() => setWeek(addDays(week, 7))}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                    <button className="today-button" onClick={() => setWeek(monday(clock))}>
                      {t('Сегодня')}{' '}
                    </button>
                  </div>
                  <div className="view-switch" aria-label={t('Вид расписания')}>
                    <button
                      className={view === 'week' ? 'selected' : ''}
                      aria-label={t('Неделя')}
                      aria-pressed={view === 'week'}
                      onClick={() => setView('week')}
                    >
                      <LayoutGrid size={15} />
                      <span>{t('Неделя')}</span>
                    </button>
                    <button
                      className={view === 'list' ? 'selected' : ''}
                      aria-label={t('Список')}
                      aria-pressed={view === 'list'}
                      onClick={() => setView('list')}
                    >
                      <List size={16} />
                      <span>{t('Список')}</span>
                    </button>
                  </div>
                </div>
                <div className="filter-toolbar">
                  <div className="filter-left">
                    <label className="group-selector">
                      <UsersRound size={16} />
                      <select
                        aria-label={t('Учебная группа')}
                        value={group.id}
                        onChange={(e) => setGroupId(e.target.value)}
                      >
                        {data.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={13} />
                    </label>
                    <span className="filter-divider" />
                    <label className="type-selector">
                      <select
                        aria-label={t('Формат занятий')}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">{t('Все занятия')}</option>
                        {TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t(type)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={13} />
                    </label>
                    <span className="week-badge">
                      {isoWeek(week) % 2 === 0 ? t('Чётная неделя') : t('Нечётная неделя')}
                    </span>
                  </div>
                  <div className="filter-right">
                    <SubjectPicker
                      subjects={data.subjects}
                      value={subjectFilter}
                      onChange={setSubjectFilter}
                    />
                    <button
                      className="icon-button export-button"
                      aria-label={t('Скачать календарь ICS')}
                      title={t('Скачать выбранные занятия в календарь')}
                      onClick={exportCalendar}
                    >
                      <ArrowDownToLine size={18} />
                    </button>
                  </div>
                </div>

                {teacherFilter && (
                  <div className="active-teacher-filter">
                    <span>
                      {t('Преподаватель')}:{' '}
                      {data.teachers.find((teacher) => teacher.id === teacherFilter)?.name}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={t('Сбросить фильтр преподавателя')}
                      onClick={() => setTeacherFilter('')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {visible.length === 0 && (view === 'list' || hasScheduleFilters) ? (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Search size={28} />
                    </span>
                    <h3>
                      {hasScheduleFilters ? t('Ничего не нашлось') : t('Неделя — чистый лист')}
                    </h3>
                    <p>
                      {hasScheduleFilters
                        ? t('Выберите другой предмет или сбросьте фильтры.')
                        : t('Добавь первое занятие и задай свой ритм.')}
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        if (hasScheduleFilters) {
                          setSubjectFilter('all');
                          setTeacherFilter('');
                          setFilter('all');
                        } else setModal({ type: 'lesson' });
                      }}
                    >
                      {hasScheduleFilters ? t('Сбросить фильтры') : t('Добавить занятие')}
                    </button>
                  </div>
                ) : view === 'week' ? (
                  <div
                    className="calendar-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={t('Расписание по парам')}
                  >
                    <table className="period-table" aria-label={t('Расписание по парам')}>
                      <thead>
                        <tr>
                          <th scope="col" className="period-corner">
                            {t('Пара / время')}
                          </th>
                          {DAYS.map((day, index) => (
                            <th scope="col" key={day}>
                              <div
                                className={`day-heading ${isCurrent && index === dayIndex ? 'is-today' : ''}`}
                              >
                                <span>
                                  {t(SHORT_DAYS[index])}
                                  <span className="day-full"> · {t(day)}</span>
                                </span>
                                <strong>{addDays(week, index).getDate()}</strong>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((period) => (
                          <tr key={`${period.start}-${period.end}`}>
                            <th scope="row" className="period-axis">
                              <PeriodLabel period={period} />
                            </th>
                            {DAYS.map((day, dayNumber) => {
                              const lessons = visible.filter(
                                (lesson) =>
                                  lesson.day === dayNumber &&
                                  lesson.start === period.start &&
                                  lesson.end === period.end,
                              );
                              const current =
                                isCurrent &&
                                dayNumber === dayIndex &&
                                timeNow >= minutes(period.start) &&
                                timeNow < minutes(period.end);
                              return (
                                <td
                                  key={day}
                                  className={`period-cell ${isCurrent && dayNumber === dayIndex ? 'today-column' : ''} ${current ? 'current-period' : ''}`}
                                >
                                  {lessons.length ? (
                                    lessons.map((lesson) => (
                                      <LessonCard
                                        key={lesson.id}
                                        lesson={lesson}
                                        subject={data.subjects.find(
                                          (subject) => subject.id === lesson.subjectId,
                                        )!}
                                        teacher={lessonTeacher(lesson, data)}
                                        compact
                                        onClick={() => setModal({ type: 'lesson', lesson })}
                                      />
                                    ))
                                  ) : period.number !== null ? (
                                    <button
                                      className="empty-period"
                                      aria-label={t('Добавить: {day}, пара {number}', {
                                        day: t(day),
                                        number: period.number,
                                      })}
                                      onClick={() =>
                                        setModal({
                                          type: 'lesson',
                                          slot: {
                                            day: dayNumber,
                                            start: period.start,
                                            end: period.end,
                                          },
                                        })
                                      }
                                    >
                                      <Plus size={17} aria-hidden="true" />
                                    </button>
                                  ) : (
                                    <span className="empty-period-mark">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="agenda">
                    {DAYS.map((day, index) => {
                      const dayLessons = visible.filter((l) => l.day === index);
                      if (!dayLessons.length) return null;
                      return (
                        <section className="agenda-day" key={day}>
                          <div className="agenda-date">
                            <strong>{addDays(week, index).getDate()}</strong>
                            <div>
                              <h3>{t(day)}</h3>
                              <span>
                                {dayLessons.length}{' '}
                                {plural(dayLessons.length, ['занятие', 'занятия', 'занятий'])}
                              </span>
                            </div>
                          </div>
                          <div className="agenda-lessons">
                            {dayLessons.map((lesson) => {
                              const subject = data.subjects.find((s) => s.id === lesson.subjectId)!;
                              return (
                                <div className="agenda-entry" key={lesson.id}>
                                  <PeriodLabel
                                    period={periods.find(
                                      (period) =>
                                        period.start === lesson.start && period.end === lesson.end,
                                    )!}
                                  />
                                  <LessonCard
                                    lesson={lesson}
                                    subject={subject}
                                    teacher={lessonTeacher(lesson, data)}
                                    onClick={() => setModal({ type: 'lesson', lesson })}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
                <footer className="calendar-footer">
                  <div className="legend">
                    <span>
                      <i className="sage" />
                      {t('Точные науки')}{' '}
                    </span>
                    <span>
                      <i className="lavender" />
                      {t('Технологии')}{' '}
                    </span>
                    <span>
                      <i className="peach" />
                      {t('И не только')}{' '}
                    </span>
                  </div>
                  <span>
                    {visible.length} {plural(visible.length, ['занятие', 'занятия', 'занятий'])}
                    {t('· время местное')}{' '}
                  </span>
                </footer>
              </section>
              <section className="bottom-note">
                <span>
                  <Sparkles size={16} />
                  {nextLesson
                    ? `${minutes(nextLesson.start) <= timeNow ? t('Сейчас') : t('Далее')}: ${data.subjects.find((s) => s.id === nextLesson.subjectId)?.name} · ${nextLesson.start} · ${t('ауд.')} ${nextLesson.room}`
                    : isCurrent
                      ? t('Всё под контролем. Хорошее время для своих планов.')
                      : t('Новая неделя — новые возможности.')}
                </span>
                <button onClick={() => setModal({ type: 'help' })}>
                  {t('Как это работает')} <ArrowRight size={14} />
                </button>
              </section>
            </>
          )}

          {(page === 'subjects' || page === 'teachers') && (
            <>
              <div className="directory-toolbar">
                <span>
                  {page === 'subjects'
                    ? t('{count} дисциплин в пространстве', { count: data.subjects.length })
                    : t('{count} преподавателей в пространстве', { count: data.teachers.length })}
                </span>
                {page === 'subjects' ? (
                  <SubjectPicker
                    subjects={data.subjects}
                    value={subjectFilter}
                    onChange={setSubjectFilter}
                  />
                ) : (
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      aria-label={t('Поиск по справочнику')}
                      placeholder={t('Найти преподавателя…')}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                )}
              </div>
              <div className="directory-grid">
                {page === 'subjects'
                  ? data.subjects
                      .filter((s) => subjectFilter === 'all' || s.id === subjectFilter)
                      .map((subject) => {
                        const teachers = subjectTeachers(subject, data);
                        const count = data.lessons.filter(
                          (l) =>
                            l.subjectId === subject.id &&
                            l.groupId === group.id &&
                            activeInWeek(l, week),
                        ).length;
                        return (
                          <article key={subject.id} className="subject-card">
                            <div className={`subject-banner ${subject.color}`}>
                              <span className="subject-symbol">
                                <BookOpen size={24} />
                              </span>
                              <span>{subject.code}</span>
                              <div className="banner-rings" />
                            </div>
                            <div className="subject-content">
                              <h2>{subject.name}</h2>
                              <p>
                                <UsersRound size={15} />
                                {teachers.length
                                  ? teachers
                                      .map((teacher) => teacher.short ?? shortName(teacher.name))
                                      .join(' · ')
                                  : t('Преподаватель не указан')}
                              </p>
                              <div className="subject-card-footer">
                                <span>
                                  {count} {t('в неделю ·')} {group.name}
                                </span>
                                <button
                                  className="icon-button"
                                  aria-label={t('Показать занятия: {subject}', {
                                    subject: subject.name,
                                  })}
                                  onClick={() => {
                                    navigate('schedule');
                                    setSubjectFilter(subject.id);
                                  }}
                                >
                                  <ArrowUpRight size={18} />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })
                  : data.teachers
                      .filter((t) => `${t.name} ${t.department}`.toLowerCase().includes(search))
                      .map((teacher, index) => (
                        <article className="teacher-card" key={teacher.id}>
                          <span className={`teacher-avatar ${TONES[index % TONES.length]}`}>
                            {initials(teacher.name)}
                          </span>
                          <h2>{teacher.name}</h2>
                          <p>{teacher.department}</p>
                          {teacher.source && (
                            <a
                              className="source-link"
                              href={teacher.source}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('Источник UrDU')} <ArrowUpRight size={12} />
                            </a>
                          )}
                          <div className="teacher-subjects">
                            {data.subjects
                              .filter((s) =>
                                subjectTeachers(s, data).some((t) => t.id === teacher.id),
                              )
                              .map((s) => (
                                <span key={s.id} className={s.color}>
                                  {s.name}
                                </span>
                              ))}
                          </div>
                          <button
                            className="button secondary"
                            onClick={() => {
                              navigate('schedule');
                              setTeacherFilter(teacher.id);
                            }}
                          >
                            {t('Занятия ·')} {group.name}
                            <ArrowUpRight size={16} />
                          </button>
                        </article>
                      ))}
              </div>
              {(page === 'subjects'
                ? data.subjects.filter((s) => subjectFilter === 'all' || s.id === subjectFilter)
                : data.teachers.filter((t) =>
                    `${t.name} ${t.department}`.toLowerCase().includes(search),
                  )
              ).length === 0 && (
                <div className="empty-state">
                  <Search size={28} />
                  <h3>{t('Ничего не нашлось')}</h3>
                  <p>{t('Попробуй изменить поисковый запрос.')}</p>
                </div>
              )}
            </>
          )}

          {page === 'settings' && (
            <div className="settings-grid">
              <section className="settings-card">
                <span className="stat-icon sage">
                  <UsersRound size={22} />
                </span>
                <h2>{t('Учебные группы')}</h2>
                <p>{t('Разные направления — одно удобное пространство.')}</p>
                <div className="group-list">
                  {data.groups.map((g) => (
                    <div key={g.id}>
                      <span className="group-avatar">{g.name.slice(0, 2)}</span>
                      <div>
                        <strong>{g.name}</strong>
                        <p>{g.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="button secondary" onClick={() => setModal({ type: 'group' })}>
                  <Plus size={16} />
                  {t('Добавить группу')}{' '}
                </button>
              </section>
              <section className="settings-card">
                <span className="stat-icon lavender">
                  <Download size={22} />
                </span>
                <h2>{t('Твои данные — с тобой')}</h2>
                <p>
                  {t(
                    'Расписание сохраняется в этом браузере. Скачай копию, чтобы перенести его на другое устройство или сохранить перед очисткой браузера.',
                  )}{' '}
                </p>
                <div className="settings-actions">
                  <button
                    className="button primary"
                    onClick={() => {
                      download(
                        JSON.stringify(data, null, 2),
                        'tempo-backup.json',
                        'application/json',
                      );
                      notify('Резервная копия скачана');
                    }}
                  >
                    <Download size={16} />
                    {t('Скачать копию JSON')}{' '}
                  </button>
                  <button className="button secondary" onClick={() => fileInput.current?.click()}>
                    <Upload size={16} />
                    {t('Импортировать копию')}{' '}
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => void importFile(e.target.files?.[0])}
                  />
                </div>
                <div className="settings-fact">
                  <Check size={16} />
                  {t('Без регистрации и внешних сервисов')}{' '}
                </div>
              </section>
              <section className="settings-card full-width">
                <div>
                  <h2>{t('Начать с примера')}</h2>
                  <p>
                    {t(
                      'Восстановить демонстрационные предметы, группы и занятия. Текущие данные будут заменены.',
                    )}{' '}
                  </p>
                </div>
                <button className="button secondary" onClick={() => setModal({ type: 'reset' })}>
                  {t('Восстановить демоданные')}{' '}
                </button>
              </section>
              <p className="settings-footnote">
                {t('Личный планировщик. Данные не синхронизируются между устройствами.')}{' '}
              </p>
            </div>
          )}
          <div className="academic-note">
            <span>
              {t('Проект по предмету Loyihalarni boshqarish')} · Xusainov Sh. M. / Yuldashov O. E.
            </span>
            <span>{t('Пример расписания: время, группы и аудитории необходимо уточнить.')}</span>
          </div>
          <footer className="page-footer">
            <span>
              tempo. <span>{t('С заботой о твоём времени')}</span>
            </span>
            <span>{t('Больше, чем просто планы.')}</span>
          </footer>
        </main>
      </div>

      {modal?.type === 'lesson' && (
        <LessonForm
          lesson={modal.lesson}
          data={data}
          groupId={group.id}
          slot={modal.slot}
          onSave={saveLesson}
          onDelete={deleteLesson}
          onClose={() => setModal(null)}
        />
      )}
      {(modal?.type === 'subject' || modal?.type === 'teacher' || modal?.type === 'group') && (
        <DirectoryForm
          type={modal.type}
          data={data}
          onSave={(next) => {
            persist(next);
            setModal(null);
            notify('Добавлено в пространство');
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'help' && (
        <Modal
          title={t('Привет, это Tempo.')}
          subtitle={t('Маленькое пространство для больших планов.')}
          onClose={() => setModal(null)}
        >
          <div className="help-content">
            <p>
              <CalendarDays size={21} />
              <span>
                <strong>{t('Собери свою неделю')}</strong>
                {t(
                  'Выбери группу и добавь занятия. Расписание повторяется каждую неделю или по её чётности (ISO).',
                )}{' '}
              </span>
            </p>
            <p>
              <BookOpen size={21} />
              <span>
                <strong>{t('Всё можно поправить')}</strong>
                {t(
                  'Нажми на занятие, чтобы изменить время, аудиторию или оставить заметку. Пересечения проверяются автоматически.',
                )}{' '}
              </span>
            </p>
            <p>
              <Download size={21} />
              <span>
                <strong>{t('Возьми планы с собой')}</strong>
                {t(
                  'Стрелка рядом с выбором предмета скачивает видимые занятия выбранной недели в формате ICS для Apple, Google и других календарей.',
                )}{' '}
              </span>
            </p>
            <p>
              <Settings2 size={21} />
              <span>
                <strong>{t('Только в этом браузере')}</strong>
                {t(
                  'Это личное пространство без сервера и входа. Делай резервные копии в настройках; синхронизации между устройствами нет.',
                )}{' '}
              </span>
            </p>
          </div>
          <button className="button primary full-button" onClick={() => setModal(null)}>
            {t('Поймать свой ритм')} <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {(modal?.type === 'reset' || modal?.type === 'import') && (
        <Modal
          title={
            modal.type === 'reset' ? t('Восстановить демоданные?') : t('Заменить данные из копии?')
          }
          onClose={() => setModal(null)}
        >
          <p className="confirm-text">
            {t(
              'Текущее расписание, предметы, преподаватели и группы будут заменены. Сначала можно скачать резервную копию.',
            )}{' '}
          </p>
          <button
            className="text-button backup-link"
            onClick={() =>
              download(JSON.stringify(data, null, 2), 'tempo-backup.json', 'application/json')
            }
          >
            <Download size={15} />
            {t('Скачать текущую копию')}{' '}
          </button>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              {t('Отмена')}{' '}
            </button>
            <button
              className="button primary"
              onClick={() => {
                const next = modal.type === 'reset' ? createDemo() : modal.data;
                persist(next);
                setGroupId(next.groups[0].id);
                setModal(null);
                notify('Данные обновлены');
              }}
            >
              {t('Заменить данные')}{' '}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-check">
            <Check size={16} />
          </span>
          <span>{t(toast)}</span>
          {undo && (
            <button
              onClick={() => {
                const error = validateLesson(undo, data);
                if (error) {
                  notify(error);
                  return;
                }
                persist({ ...data, lessons: [...data.lessons, undo] });
                notify('Занятие восстановлено');
              }}
            >
              <ArrowLeft size={14} />
              {t('Вернуть')}{' '}
            </button>
          )}
          <button
            className="toast-close"
            aria-label={t('Закрыть уведомление')}
            onClick={() => {
              setToast('');
              setUndo(null);
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
