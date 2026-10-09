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
  STORAGE_KEY,
  activeInWeek,
  addDays,
  calendarExport,
  createDemo,
  dateLabel,
  download,
  initials,
  isoWeek,
  loadData,
  minutes,
  monday,
  parseData,
  plural,
  shortName,
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

type Page = 'schedule' | 'subjects' | 'teachers' | 'settings';
type ModalState =
  | { type: 'lesson'; lesson?: Lesson }
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
const HOUR_HEIGHT = 92;

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
          <span className="eyebrow">ТВОЁ ПРОСТРАНСТВО</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" className="icon-button" aria-label="Закрыть окно" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function LessonForm({
  lesson,
  data,
  groupId,
  onSave,
  onDelete,
  onClose,
}: {
  lesson?: Lesson;
  data: Data;
  groupId: string;
  onSave: (lesson: Lesson) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Lesson>(
    lesson ?? {
      id: uid(),
      subjectId: data.subjects[0].id,
      groupId,
      day: (new Date().getDay() + 6) % 7 > 5 ? 0 : (new Date().getDay() + 6) % 7,
      start: '09:00',
      end: '10:20',
      room: '',
      type: 'Лекция',
      frequency: 'every',
      note: '',
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
    const issue = validateLesson(clean, data);
    if (issue) {
      setError(issue);
      return;
    }
    onSave(clean);
  }
  return (
    <Modal
      title={lesson ? 'Детали занятия' : 'Новое занятие'}
      subtitle="Немного порядка для продуктивной недели."
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label>
          Предмет
          <select value={draft.subjectId} onChange={(e) => set('subjectId', e.target.value)}>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Группа
            <select value={draft.groupId} onChange={(e) => set('groupId', e.target.value)}>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Формат
            <select value={draft.type} onChange={(e) => set('type', e.target.value as LessonType)}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            День недели
            <select value={draft.day} onChange={(e) => set('day', Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            Повторение
            <select
              value={draft.frequency}
              onChange={(e) => set('frequency', e.target.value as Frequency)}
            >
              {Object.entries(FREQUENCIES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row time-row">
          <label>
            Начало
            <input
              required
              type="time"
              min="08:00"
              max="19:30"
              value={draft.start}
              onChange={(e) => set('start', e.target.value)}
            />
          </label>
          <label>
            Окончание
            <input
              required
              type="time"
              min="08:30"
              max="20:00"
              value={draft.end}
              onChange={(e) => set('end', e.target.value)}
            />
          </label>
          <label>
            Аудитория
            <input
              required
              maxLength={60}
              placeholder="Например, 301"
              value={draft.room}
              onChange={(e) => set('room', e.target.value)}
            />
          </label>
        </div>
        <label>
          Заметка <span className="optional">необязательно</span>
          <textarea
            rows={2}
            maxLength={1000}
            placeholder="Что подготовить к занятию?"
            value={draft.note}
            onChange={(e) => set('note', e.target.value)}
          />
        </label>
        <div className="form-hint">
          <UsersRound size={16} />
          <span>
            {
              data.teachers.find(
                (t) => t.id === data.subjects.find((s) => s.id === draft.subjectId)?.teacherId,
              )?.name
            }
          </span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {deleting && (
          <div className="delete-confirm">
            <p>Удалить это занятие из всех недель?</p>
            <button type="button" className="danger-button" onClick={() => onDelete(draft.id)}>
              Да, удалить занятие
            </button>
            <button type="button" className="text-button" onClick={() => setDeleting(false)}>
              Отмена
            </button>
          </div>
        )}
        <div className="modal-actions">
          {lesson && (
            <button
              type="button"
              className="icon-button delete-button"
              aria-label="Удалить занятие"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" type="submit">
            <Check size={17} />
            {lesson ? 'Сохранить изменения' : 'Добавить занятие'}
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
          ? 'Новый предмет'
          : type === 'teacher'
            ? 'Новый преподаватель'
            : 'Новая группа'
      }
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <label>
          {type === 'teacher' ? 'Фамилия, имя и отчество' : 'Название'}
          <input
            name="name"
            required
            maxLength={type === 'group' ? 60 : 100}
            placeholder={
              type === 'subject'
                ? 'Например, Дискретная математика'
                : type === 'teacher'
                  ? 'Например, Иванов Алексей Сергеевич'
                  : 'Например, ИС-23'
            }
          />
        </label>
        <label>
          {type === 'subject'
            ? 'Код предмета'
            : type === 'teacher'
              ? 'Кафедра'
              : 'Направление и курс'}
          <input
            name="detail"
            required
            maxLength={type === 'subject' ? 30 : type === 'teacher' ? 120 : 150}
            placeholder={
              type === 'subject'
                ? 'MATH 205'
                : type === 'teacher'
                  ? 'Компьютерные науки'
                  : 'Информационные системы · 2 курс'
            }
          />
        </label>
        {type === 'subject' && (
          <>
            <label>
              Преподаватель
              <select name="teacher">
                {data.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="color-field">
              <legend>Цвет в расписании</legend>
              {TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  className={`color-option ${tone} ${color === tone ? 'selected' : ''}`}
                  aria-label={`Цвет ${tone}`}
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
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="button primary">
            <Plus size={17} />
            Добавить
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
  teacher: Teacher;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`lesson-card ${subject.color} ${compact ? 'compact' : ''} ${compact && minutes(lesson.end) - minutes(lesson.start) < 60 ? 'short-lesson' : ''}`}
      onClick={onClick}
      aria-label={`${subject.name}, ${DAYS[lesson.day]}, ${lesson.start}–${lesson.end}, аудитория ${lesson.room}`}
    >
      <div className="lesson-meta">
        <span>
          {lesson.start} — {lesson.end}
        </span>
        <span className="lesson-type" title={lesson.type}>
          {lesson.type === 'Лабораторная' ? 'Лаб.' : lesson.type}
        </span>
      </div>
      <h3>{subject.name}</h3>
      <div className="lesson-details">
        <span>
          <MapPin size={12} />
          {lesson.room}
        </span>
        <span className="teacher-short">{shortName(teacher.name)}</span>
      </div>
      {!compact && lesson.note && <div className="lesson-note">{lesson.note}</div>}
    </button>
  );
}

export default function App() {
  const [initial] = useState(loadData);
  const [data, setData] = useState(initial.data);
  const [warning, setWarning] = useState(initial.warning);
  const [page, setPage] = useState<Page>('schedule');
  const [week, setWeek] = useState(() => monday(new Date()));
  const [groupId, setGroupId] = useState(data.groups[0].id);
  const [query, setQuery] = useState('');
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
  const visible = weekLessons
    .filter((l) => {
      const subject = data.subjects.find((s) => s.id === l.subjectId)!;
      const teacher = data.teachers.find((t) => t.id === subject.teacherId)!;
      return (
        (filter === 'all' || l.type === filter) &&
        `${subject.name} ${subject.code} ${teacher.name} ${l.room}`
          .toLocaleLowerCase()
          .includes(search)
      );
    })
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
  const startHour = Math.min(9, ...visible.map((l) => Math.floor(minutes(l.start) / 60)));
  const endHour = Math.max(17, ...visible.map((l) => Math.ceil(minutes(l.end) / 60)));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const calendarHeight = (endHour - startHour) * HOUR_HEIGHT;
  function exportCalendar() {
    download(
      calendarExport(visible, data, week),
      `tempo-${group.name}-${dateLabel(week, { year: 'numeric', month: '2-digit', day: '2-digit' })}.ics`,
      'text/calendar;charset=utf-8',
    );
    notify('Календарь выбранных занятий скачан');
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Файл слишком большой. Максимум — 2 МБ.');
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
          aria-label="Закрыть меню"
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
            <strong>Мой кампус</strong>
            <span>Учебное пространство</span>
          </div>
        </div>
        <div className="nav-caption">ОРГАНИЗУЙ СВОЙ ДЕНЬ</div>
        <nav aria-label="Основная навигация">
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
              <span>{PAGES[item.id]}</span>
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
            <h3>Поймай свой ритм.</h3>
            <p>
              Когда всё на своих местах,
              <br />
              остаётся время на главное.
            </p>
            <button onClick={() => setModal({ type: 'help' })}>
              Знакомство с Tempo <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Settings2 size={19} />
            <span>Настройки</span>
          </button>
          <div className="sidebar-footer">
            <span className="online-dot" />В твоём ритме<span>v1.0</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Открыть меню"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <span>Мой кампус</span>
            <ChevronRight size={13} />
            <strong>{PAGES[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="today-date">
              {dateLabel(clock, { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="top-divider" />
            <button
              className="icon-button help-button"
              aria-label="Помощь"
              onClick={() => setModal({ type: 'help' })}
            >
              <CircleHelp size={19} />
            </button>
            <span className="profile-avatar" title="Личное пространство">
              Т
            </span>
          </div>
        </header>
        <main>
          {warning && (
            <div className="warning" role="alert">
              {warning}
            </div>
          )}
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-dot" />{' '}
                {page === 'schedule' ? 'МЕНЬШЕ ХАОСА. БОЛЬШЕ ФОКУСА.' : 'ВСЁ В ОДНОМ МЕСТЕ'}
              </div>
              <h1>
                {page === 'schedule' ? 'Твоя неделя в порядке' : PAGES[page]}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === 'schedule'
                  ? 'Учись, планируй и находи время для себя.'
                  : page === 'subjects'
                    ? 'Все дисциплины и их место в твоём расписании.'
                    : page === 'teachers'
                      ? 'Те, кто помогает двигаться вперёд.'
                      : 'Твоё пространство работает по твоим правилам.'}
              </p>
            </div>
            {page === 'schedule' ? (
              <button
                className="button primary add-main"
                onClick={() => setModal({ type: 'lesson' })}
              >
                <Plus size={18} />
                Добавить занятие
              </button>
            ) : page === 'subjects' || page === 'teachers' ? (
              <button
                className="button primary"
                onClick={() => setModal({ type: page === 'subjects' ? 'subject' : 'teacher' })}
              >
                <Plus size={18} />
                {page === 'subjects' ? 'Добавить предмет' : 'Добавить преподавателя'}
              </button>
            ) : (
              <div className="privacy-badge">
                <span className="online-dot" />
                Локальное пространство
              </div>
            )}
          </section>

          {page === 'schedule' && (
            <>
              <section className="stats" aria-label="Обзор недели">
                <div className="stat-card">
                  <span className="stat-icon sage">
                    <CalendarDays size={20} />
                  </span>
                  <div>
                    <span className="stat-label">На этой неделе</span>
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
                    <span className="stat-label">Время учиться</span>
                    <strong>
                      {Math.round((totalMinutes / 60) * 10) / 10}
                      <small>часов</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon peach">
                    <BookOpen size={20} />
                  </span>
                  <div>
                    <span className="stat-label">В фокусе</span>
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
                    <span className="stat-label">Время для себя</span>
                    <strong>
                      {freeDays}
                      <small>
                        {plural(freeDays, ['свободный день', 'свободных дня', 'свободных дней'])}
                      </small>
                    </strong>
                  </div>
                </div>
              </section>

              <section className="schedule-panel" aria-label="Расписание занятий">
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
                        aria-label="Предыдущая неделя"
                        onClick={() => setWeek(addDays(week, -7))}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Следующая неделя"
                        onClick={() => setWeek(addDays(week, 7))}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                    <button className="today-button" onClick={() => setWeek(monday(clock))}>
                      Сегодня
                    </button>
                  </div>
                  <div className="view-switch" aria-label="Вид расписания">
                    <button
                      className={view === 'week' ? 'selected' : ''}
                      aria-label="Неделя"
                      aria-pressed={view === 'week'}
                      onClick={() => setView('week')}
                    >
                      <LayoutGrid size={15} />
                      <span>Неделя</span>
                    </button>
                    <button
                      className={view === 'list' ? 'selected' : ''}
                      aria-label="Список"
                      aria-pressed={view === 'list'}
                      onClick={() => setView('list')}
                    >
                      <List size={16} />
                      <span>Список</span>
                    </button>
                  </div>
                </div>
                <div className="filter-toolbar">
                  <div className="filter-left">
                    <label className="group-selector">
                      <UsersRound size={16} />
                      <select
                        aria-label="Учебная группа"
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
                        aria-label="Формат занятий"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">Все занятия</option>
                        {TYPES.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} />
                    </label>
                    <span className="week-badge">
                      {isoWeek(week) % 2 === 0 ? 'Чётная' : 'Нечётная'} неделя
                    </span>
                  </div>
                  <div className="filter-right">
                    <label className="search-field">
                      <Search size={16} />
                      <input
                        aria-label="Поиск в расписании"
                        placeholder="Найти занятие…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          className="clear-search"
                          aria-label="Очистить поиск"
                          onClick={() => setQuery('')}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <button
                      className="icon-button export-button"
                      aria-label="Скачать календарь ICS"
                      title="Скачать выбранные занятия в календарь"
                      onClick={exportCalendar}
                    >
                      <ArrowDownToLine size={18} />
                    </button>
                  </div>
                </div>

                {visible.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Search size={28} />
                    </span>
                    <h3>
                      {search || filter !== 'all' ? 'Ничего не нашлось' : 'Неделя — чистый лист'}
                    </h3>
                    <p>
                      {search || filter !== 'all'
                        ? 'Попробуй другой запрос или убери фильтры.'
                        : 'Добавь первое занятие и задай свой ритм.'}
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        if (search || filter !== 'all') {
                          setQuery('');
                          setFilter('all');
                        } else setModal({ type: 'lesson' });
                      }}
                    >
                      {search || filter !== 'all' ? 'Сбросить фильтры' : 'Добавить занятие'}
                    </button>
                  </div>
                ) : view === 'week' ? (
                  <div className="calendar-scroll">
                    <div className="calendar">
                      <div className="calendar-day-headings">
                        <div className="timezone-label">ВРЕМЯ</div>
                        {DAYS.map((day, index) => {
                          const date = addDays(week, index);
                          const isToday = isCurrent && index === dayIndex;
                          return (
                            <div key={day} className={`day-heading ${isToday ? 'is-today' : ''}`}>
                              <span>
                                {SHORT_DAYS[index]}
                                <span className="day-full"> · {day}</span>
                              </span>
                              <strong>{date.getDate()}</strong>
                              {isToday && <i />}
                            </div>
                          );
                        })}
                      </div>
                      <div className="calendar-body" style={{ height: calendarHeight + 18 }}>
                        <div className="time-axis">
                          {hours.map((hour) => (
                            <span key={hour} style={{ top: (hour - startHour) * HOUR_HEIGHT }}>
                              {String(hour).padStart(2, '0')}:00
                            </span>
                          ))}
                        </div>
                        {DAYS.map((day, index) => (
                          <div
                            className={`day-column ${isCurrent && index === dayIndex ? 'today-column' : ''}`}
                            key={day}
                            style={{ height: calendarHeight }}
                          >
                            {hours.slice(0, -1).map((hour) => (
                              <div
                                key={hour}
                                className="hour-cell"
                                style={{
                                  top: (hour - startHour) * HOUR_HEIGHT,
                                  height: HOUR_HEIGHT,
                                }}
                              />
                            ))}
                            {visible
                              .filter((l) => l.day === index)
                              .map((lesson) => {
                                const subject = data.subjects.find(
                                  (s) => s.id === lesson.subjectId,
                                )!;
                                const teacher = data.teachers.find(
                                  (t) => t.id === subject.teacherId,
                                )!;
                                return (
                                  <div
                                    className="calendar-event"
                                    key={lesson.id}
                                    style={{
                                      top:
                                        (minutes(lesson.start) / 60 - startHour) * HOUR_HEIGHT + 3,
                                      height:
                                        ((minutes(lesson.end) - minutes(lesson.start)) / 60) *
                                          HOUR_HEIGHT -
                                        6,
                                    }}
                                  >
                                    <LessonCard
                                      lesson={lesson}
                                      subject={subject}
                                      teacher={teacher}
                                      compact
                                      onClick={() => setModal({ type: 'lesson', lesson })}
                                    />
                                  </div>
                                );
                              })}
                            {index === 5 && !visible.some((l) => l.day === 5) && (
                              <div className="free-day">
                                <Coffee size={24} />
                                <span>Можно выдохнуть</span>
                                <small>День без занятий</small>
                              </div>
                            )}
                            {isCurrent &&
                              index === dayIndex &&
                              timeNow >= startHour * 60 &&
                              timeNow <= endHour * 60 && (
                                <div
                                  className="now-line"
                                  style={{ top: (timeNow / 60 - startHour) * HOUR_HEIGHT }}
                                >
                                  <i />
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
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
                              <h3>{day}</h3>
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
                                <LessonCard
                                  key={lesson.id}
                                  lesson={lesson}
                                  subject={subject}
                                  teacher={data.teachers.find((t) => t.id === subject.teacherId)!}
                                  onClick={() => setModal({ type: 'lesson', lesson })}
                                />
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
                      Точные науки
                    </span>
                    <span>
                      <i className="lavender" />
                      Технологии
                    </span>
                    <span>
                      <i className="peach" />И не только
                    </span>
                  </div>
                  <span>
                    {visible.length} {plural(visible.length, ['занятие', 'занятия', 'занятий'])} ·
                    время местное
                  </span>
                </footer>
              </section>
              <section className="bottom-note">
                <span>
                  <Sparkles size={16} />
                  {nextLesson
                    ? `${minutes(nextLesson.start) <= timeNow ? 'Сейчас' : 'Далее'}: ${data.subjects.find((s) => s.id === nextLesson.subjectId)?.name} · ${nextLesson.start} · ауд. ${nextLesson.room}`
                    : isCurrent
                      ? 'Всё под контролем. Хорошее время для своих планов.'
                      : 'Новая неделя — новые возможности.'}
                </span>
                <button onClick={() => setModal({ type: 'help' })}>
                  Как это работает <ArrowRight size={14} />
                </button>
              </section>
            </>
          )}

          {(page === 'subjects' || page === 'teachers') && (
            <>
              <div className="directory-toolbar">
                <span>
                  {page === 'subjects'
                    ? `${data.subjects.length} дисциплин в пространстве`
                    : `${data.teachers.length} преподавателей в пространстве`}
                </span>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Поиск по справочнику"
                    placeholder={page === 'subjects' ? 'Найти предмет…' : 'Найти преподавателя…'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="directory-grid">
                {page === 'subjects'
                  ? data.subjects
                      .filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(search))
                      .map((subject) => {
                        const teacher = data.teachers.find((t) => t.id === subject.teacherId)!;
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
                                {shortName(teacher.name)}
                              </p>
                              <div className="subject-card-footer">
                                <span>
                                  {count} в неделю · {group.name}
                                </span>
                                <button
                                  className="icon-button"
                                  aria-label={`Показать занятия: ${subject.name}`}
                                  onClick={() => {
                                    setPage('schedule');
                                    setQuery(subject.name);
                                    setFilter('all');
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
                          <div className="teacher-subjects">
                            {data.subjects
                              .filter((s) => s.teacherId === teacher.id)
                              .map((s) => (
                                <span key={s.id} className={s.color}>
                                  {s.name}
                                </span>
                              ))}
                          </div>
                          <button
                            className="button secondary"
                            onClick={() => {
                              setPage('schedule');
                              setQuery(teacher.name);
                              setFilter('all');
                            }}
                          >
                            Занятия · {group.name}
                            <ArrowUpRight size={16} />
                          </button>
                        </article>
                      ))}
              </div>
              {(page === 'subjects'
                ? data.subjects.filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(search))
                : data.teachers.filter((t) =>
                    `${t.name} ${t.department}`.toLowerCase().includes(search),
                  )
              ).length === 0 && (
                <div className="empty-state">
                  <Search size={28} />
                  <h3>Ничего не нашлось</h3>
                  <p>Попробуй изменить поисковый запрос.</p>
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
                <h2>Учебные группы</h2>
                <p>Разные направления — одно удобное пространство.</p>
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
                  Добавить группу
                </button>
              </section>
              <section className="settings-card">
                <span className="stat-icon lavender">
                  <Download size={22} />
                </span>
                <h2>Твои данные — с тобой</h2>
                <p>
                  Расписание сохраняется в этом браузере. Скачай копию, чтобы перенести его на
                  другое устройство или сохранить перед очисткой браузера.
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
                    Скачать копию JSON
                  </button>
                  <button className="button secondary" onClick={() => fileInput.current?.click()}>
                    <Upload size={16} />
                    Импортировать копию
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
                  Без регистрации и внешних сервисов
                </div>
              </section>
              <section className="settings-card full-width">
                <div>
                  <h2>Начать с примера</h2>
                  <p>
                    Восстановить демонстрационные предметы, группы и занятия. Текущие данные будут
                    заменены.
                  </p>
                </div>
                <button className="button secondary" onClick={() => setModal({ type: 'reset' })}>
                  Восстановить демоданные
                </button>
              </section>
              <p className="settings-footnote">
                Tempo 1.0 · Персональный планировщик. Данные не синхронизируются между браузерами и
                устройствами. Демоданные вымышлены.
              </p>
            </div>
          )}
          <footer className="page-footer">
            <span>
              tempo. <span>С заботой о твоём времени</span>
            </span>
            <span>Больше, чем просто планы.</span>
          </footer>
        </main>
      </div>

      {modal?.type === 'lesson' && (
        <LessonForm
          lesson={modal.lesson}
          data={data}
          groupId={group.id}
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
          title="Привет, это Tempo."
          subtitle="Маленькое пространство для больших планов."
          onClose={() => setModal(null)}
        >
          <div className="help-content">
            <p>
              <CalendarDays size={21} />
              <span>
                <strong>Собери свою неделю</strong>Выбери группу и добавь занятия. Расписание
                повторяется каждую неделю или по её чётности (ISO).
              </span>
            </p>
            <p>
              <BookOpen size={21} />
              <span>
                <strong>Всё можно поправить</strong>Нажми на занятие, чтобы изменить время,
                аудиторию или оставить заметку. Пересечения проверяются автоматически.
              </span>
            </p>
            <p>
              <Download size={21} />
              <span>
                <strong>Возьми планы с собой</strong>Стрелка рядом с поиском скачивает видимые
                занятия выбранной недели в формате ICS для Apple, Google и других календарей.
              </span>
            </p>
            <p>
              <Settings2 size={21} />
              <span>
                <strong>Только в этом браузере</strong>Это личное пространство без сервера и входа.
                Делай резервные копии в настройках; синхронизации между устройствами нет.
              </span>
            </p>
          </div>
          <button className="button primary full-button" onClick={() => setModal(null)}>
            Поймать свой ритм <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {(modal?.type === 'reset' || modal?.type === 'import') && (
        <Modal
          title={modal.type === 'reset' ? 'Восстановить демоданные?' : 'Заменить данные из копии?'}
          onClose={() => setModal(null)}
        >
          <p className="confirm-text">
            Текущее расписание, предметы, преподаватели и группы будут заменены. Сначала можно
            скачать резервную копию.
          </p>
          <button
            className="text-button backup-link"
            onClick={() =>
              download(JSON.stringify(data, null, 2), 'tempo-backup.json', 'application/json')
            }
          >
            <Download size={15} />
            Скачать текущую копию
          </button>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Отмена
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
              Заменить данные
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-check">
            <Check size={16} />
          </span>
          <span>{toast}</span>
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
              Вернуть
            </button>
          )}
          <button
            className="toast-close"
            aria-label="Закрыть уведомление"
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
