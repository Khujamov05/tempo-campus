import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Clock3, AlertCircle, History, Send, X } from 'lucide-react';
import { supabase } from './supabase';
import { Modal } from './App';
import { useI18n } from './i18n';
import type { Profile } from './access';
import {
  LESSON_PERIODS,
  DAYS,
  FREQUENCIES,
  campusToday,
  parseDate,
  lessonsOn,
  lessonTeacher,
  exceptionConflicts,
  download,
  type Data,
  type Lesson,
  type LessonException,
} from './model';
export interface ChangeRequest {
  id: string;
  author_id: string;
  author_label: string;
  proposal: LessonException;
  baseline: Lesson & { date: string };
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  created_at: string;
  reviewed_at: string | null;
  review_note: string;
  published_revision: number | null;
}
export interface ScheduleUpdate {
  revision: number;
  created_at: string;
  kind: 'baseline' | 'publish' | 'approve' | 'restore';
  actor_label: string;
  details: {
    sourceRevision?: number;
    subjectId?: string;
    groupId?: string;
    before?: { date: string; start: string; end: string; room: string };
    after?: LessonException;
  };
}
export function workflowError(error: { code?: string; message?: string }) {
  if (error.code === 'P0001')
    return 'Данные изменились. Обновите список и проверьте заявку заново.';
  if (error.code === '23P01') return 'Есть пересечение по группе, преподавателю или аудитории.';
  if (error.code === '23505') return 'Для этой пары уже есть заявка на рассмотрении.';
  if (error.code === '42501') return 'Недостаточно прав для этого действия.';
  if (error.code === '23503')
    return 'Сначала обновите привязку аккаунтов к группам и преподавателям.';
  if (error.code === '22023')
    return 'Проверьте даты, время и обязательные поля. Прошедшие пары изменить нельзя.';
  return 'Не удалось выполнить действие. Проверьте соединение и повторите попытку.';
}
const statuses = {
  pending: 'На рассмотрении',
  approved: 'Одобрено',
  rejected: 'Возвращено',
  withdrawn: 'Отозвано',
};
const kinds = {
  baseline: 'Начальная версия',
  publish: 'Опубликовано расписание',
  approve: 'Одобрена заявка',
  restore: 'Восстановлена версия',
};
function validDate(value: string) {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
}
export function UpdateDescription({ update, data }: { update: ScheduleUpdate; data: Data }) {
  const { t } = useI18n();
  const detail = update.details;
  return (
    <>
      <strong>
        {t(kinds[update.kind])} · {t('Версия')} {update.revision}
      </strong>
      {detail.sourceRevision !== undefined && (
        <span>{t('На основе версии {version}', { version: detail.sourceRevision })}</span>
      )}
      {detail.after && (
        <span>
          {data.subjects.find((s) => s.id === detail.subjectId)?.name} ·{' '}
          {data.groups.find((g) => g.id === detail.groupId)?.name}
          <br />
          {detail.after.cancelled
            ? t('Пара отменена')
            : `${detail.after.date} · ${detail.after.start}–${detail.after.end} · ${t('Аудитория')} ${detail.after.room}`}
        </span>
      )}
    </>
  );
}
export default function Workflow({
  view,
  data,
  profile,
  revision,
  dirty,
  onChanged,
}: {
  view: 'requests' | 'history';
  data: Data;
  profile: Profile;
  revision: number;
  dirty: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t, dateLabel } = useI18n();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [updates, setUpdates] = useState<ScheduleUpdate[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState('');
  const [newRequest, setNewRequest] = useState(false);
  const [sourceDate, setSourceDate] = useState(campusToday);
  const [occurrenceId, setOccurrenceId] = useState('');
  const [targetDate, setTargetDate] = useState(campusToday);
  const [period, setPeriod] = useState(0);
  const [room, setRoom] = useState('');
  const [reason, setReason] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [snapshot, setSnapshot] = useState<{ revision: number; payload: Data } | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const admin = profile.role === 'admin';
  const format = (value: string) =>
    dateLabel(new Date(value), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  async function load() {
    if (!supabase) return;
    const [r, h] = await Promise.all([
      profile.role === 'student'
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from('schedule_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200),
      supabase.rpc('list_schedule_updates'),
    ]);
    if (r.error || h.error) throw r.error || h.error;
    setRequests(r.data as ChangeRequest[]);
    setUpdates(h.data as ScheduleUpdate[]);
    setLoaded(true);
  }
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active && !document.hidden)
        void load().catch(() => {
          if (active) setError(t('Не удалось загрузить изменения.'));
        });
    };
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [profile.id, profile.role, revision]);
  async function action(fn: () => PromiseLike<{ error: unknown }>, message: string) {
    if (busy || dirty) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await fn();
      if (result.error) throw result.error;
      await onChanged();
      await load();
      setNotice(t(message));
      return true;
    } catch (e) {
      setError(t(workflowError(e as { code?: string })));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const candidates = validDate(sourceDate)
    ? lessonsOn(data, sourceDate).filter(
        (l) => admin || lessonTeacher(l, data)?.id === profile.teacher_id,
      )
    : [];
  const occurrence = candidates.find((l) => l.id === occurrenceId);
  const change: LessonException | undefined = occurrence
    ? {
        lessonId: occurrence.templateId!,
        originalDate: occurrence.originalDate!,
        date: targetDate,
        ...LESSON_PERIODS[period],
        room: room.trim(),
        cancelled,
        reason: reason.trim(),
      }
    : undefined;
  const preview = change && validDate(targetDate) ? exceptionConflicts(data, change) : [];
  const shown = requests.filter((r) => filter === 'all' || r.status === filter);
  const chosen = shown.find((r) => r.id === selected) ?? shown[0];
  const conflicts = chosen ? exceptionConflicts(data, chosen.proposal) : [];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!change || !supabase) return;
    if (
      await action(
        () => supabase!.rpc('submit_schedule_request', { change, expected_revision: revision }),
        'Заявка отправлена',
      )
    ) {
      setNewRequest(false);
      setReason('');
      setSelected('');
      setFilter('pending');
    }
  }
  return (
    <section className="workflow-page">
      <div className="workflow-heading">
        <div>
          <span className="eyebrow">{t('СОГЛАСОВАННОЕ РАСПИСАНИЕ')}</span>
          <h1>{t(view === 'requests' ? 'Изменения под контролем' : 'История изменений')}</h1>
          <p>
            {t(
              view === 'requests'
                ? 'Перенос одной пары не меняет остальные недели.'
                : 'Каждая публикация сохраняется отдельной версией.',
            )}
          </p>
        </div>
        <div className="workflow-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setError('');
              void Promise.all([onChanged(), load()]).catch(() =>
                setError(t('Не удалось загрузить изменения.')),
              );
            }}
          >
            {t('Обновить')}
          </button>
          {view === 'requests' && profile.role !== 'student' && (
            <button
              className="button primary"
              disabled={dirty || busy}
              onClick={() => setNewRequest(!newRequest)}
            >
              <Send size={17} />
              {t('Новая заявка')}
            </button>
          )}
        </div>
      </div>
      {dirty && (
        <p className="warning">
          {t(
            'Сначала опубликуйте или сохраните копию черновика. Заявки и восстановление работают с опубликованным расписанием.',
          )}
        </p>
      )}
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="workflow-notice" role="status">
          {notice}
        </p>
      )}
      {!loaded && !error && <p role="status">{t('Загрузка…')}</p>}
      {newRequest && view === 'requests' && (
        <form className="workflow-card request-form" onSubmit={submit}>
          <div className="workflow-card-title">
            <h2>{t('Предложить изменение')}</h2>
            <button
              type="button"
              className="icon-button"
              aria-label={t('Закрыть')}
              onClick={() => setNewRequest(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="request-fields">
            <label>
              {t('Дата занятия')}
              <input
                required
                type="date"
                min={campusToday()}
                value={sourceDate}
                onChange={(e) => {
                  setSourceDate(e.target.value);
                  setTargetDate(e.target.value);
                  setOccurrenceId('');
                }}
              />
            </label>
            <label className="wide">
              {t('Занятие')}
              <select
                required
                value={occurrenceId}
                onChange={(e) => {
                  setOccurrenceId(e.target.value);
                  const l = candidates.find((x) => x.id === e.target.value);
                  if (l) {
                    setRoom(l.room);
                    setPeriod(
                      Math.max(
                        0,
                        LESSON_PERIODS.findIndex((p) => p.start === l.start),
                      ),
                    );
                  }
                }}
              >
                <option value="">{t('Выберите занятие')}</option>
                {candidates.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.start} · {data.subjects.find((s) => s.id === l.subjectId)?.name} ·{' '}
                    {data.groups.find((g) => g.id === l.groupId)?.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Действие')}
              <select
                value={cancelled ? 'cancel' : 'move'}
                onChange={(e) => setCancelled(e.target.value === 'cancel')}
              >
                <option value="move">{t('Перенести пару')}</option>
                <option value="cancel">{t('Отменить пару')}</option>
              </select>
            </label>
            <label>
              {t('Новая дата')}
              <input
                required
                type="date"
                min={campusToday()}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </label>
            {!cancelled && (
              <>
                <label>
                  {t('Пара')}
                  <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                    {LESSON_PERIODS.map((p, i) => (
                      <option value={i} key={p.start}>
                        {i + 1} · {p.start}–{p.end}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('Аудитория')}
                  <input
                    required
                    maxLength={60}
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                  />
                </label>
              </>
            )}
            <label className="wide">
              {t('Причина изменения')}
              <textarea
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </div>
          {sourceDate && candidates.length === 0 && (
            <p>{t('На эту дату доступных занятий нет.')}</p>
          )}
          {preview.length > 0 && (
            <p className="warning">
              {preview.map((c) => t(c)).join(' · ')}.{' '}
              {t('Заявку можно отправить, но одобрение требует устранения конфликтов.')}
            </p>
          )}
          <button className="button primary" disabled={busy || dirty || !occurrence}>
            {t(busy ? 'Загрузка…' : 'Отправить на согласование')}
          </button>
        </form>
      )}
      {view === 'requests' && (
        <>
          <div className="workflow-stats">
            <div>
              <Clock3 />
              <strong>{requests.filter((r) => r.status === 'pending').length}</strong>
              <span>{t('На рассмотрении')}</span>
            </div>
            <div>
              <AlertCircle />
              <strong>
                {
                  requests.filter(
                    (r) => r.status === 'pending' && exceptionConflicts(data, r.proposal).length,
                  ).length
                }
              </strong>
              <span>{t('С конфликтами')}</span>
            </div>
            <div>
              <Check />
              <strong>{requests.filter((r) => r.status === 'approved').length}</strong>
              <span>{t('Одобрено')}</span>
            </div>
          </div>
          <label className="request-filter">
            {t('Статус')}
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setSelected('');
                setReviewNote('');
              }}
            >
              <option value="all">{t('Все заявки')}</option>
              {Object.entries(statuses).map(([key, name]) => (
                <option key={key} value={key}>
                  {t(name)}
                </option>
              ))}
            </select>
          </label>
          {loaded && !shown.length && (
            <div className="workflow-card workflow-empty">
              <Check size={28} />
              <h2>{t('Здесь пока нет заявок')}</h2>
              <p>{t('Новые предложения появятся в этом списке.')}</p>
            </div>
          )}
          {chosen && (
            <div className="request-layout">
              <aside className="request-list">
                {shown.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelected(r.id);
                      setReviewNote('');
                    }}
                    className={`request-list-item ${r.id === chosen.id ? 'selected' : ''}`}
                  >
                    <span className={`status-pill ${r.status}`}>{t(statuses[r.status])}</span>
                    <strong>
                      {data.subjects.find((s) => s.id === r.baseline.subjectId)?.name ??
                        t('Занятие')}
                    </strong>
                    <span>{r.author_label}</span>
                    <small>
                      {r.baseline.date} ·{' '}
                      {data.groups.find((g) => g.id === r.baseline.groupId)?.name}
                    </small>
                  </button>
                ))}
              </aside>
              <article className="workflow-card request-detail">
                <div className="workflow-card-title">
                  <h2>
                    {t(chosen.proposal.cancelled ? 'Заявка на отмену' : 'Заявка на перенос пары')}
                  </h2>
                  <span className={`status-pill ${chosen.status}`}>
                    {t(statuses[chosen.status])}
                  </span>
                </div>
                <p className="request-byline">
                  {chosen.author_label} ·{' '}
                  {data.subjects.find((s) => s.id === chosen.baseline.subjectId)?.name} ·{' '}
                  {data.groups.find((g) => g.id === chosen.baseline.groupId)?.name}
                </p>
                <div className="change-comparison">
                  <div>
                    <small>{t('Сейчас')}</small>
                    <strong>{chosen.baseline.date}</strong>
                    <span>
                      {chosen.baseline.start}–{chosen.baseline.end}
                    </span>
                    <span>
                      {t('Аудитория')} {chosen.baseline.room}
                    </span>
                  </div>
                  <ArrowRight />
                  <div>
                    <small>{t('Предлагается')}</small>
                    <strong>
                      {chosen.proposal.cancelled ? t('Пара отменена') : chosen.proposal.date}
                    </strong>
                    {!chosen.proposal.cancelled && (
                      <>
                        <span>
                          {chosen.proposal.start}–{chosen.proposal.end}
                        </span>
                        <span>
                          {t('Аудитория')} {chosen.proposal.room}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <p>
                  <strong>{t('Причина изменения')}: </strong>
                  {chosen.proposal.reason}
                </p>
                <p className="workflow-hint">
                  {t('Меняется только выбранная дата. Недельный шаблон сохраняется.')}
                </p>
                {chosen.status === 'pending' && (
                  <div className={`conflict-check ${conflicts.length ? 'has-conflict' : ''}`}>
                    <strong>{t('Проверка конфликтов')}</strong>
                    {conflicts.length ? (
                      conflicts.map((c) => (
                        <p key={c}>
                          <AlertCircle size={16} />
                          {t(c)}
                        </p>
                      ))
                    ) : (
                      <p>
                        <Check size={17} />
                        {t('Пересечений по группе, преподавателю и аудитории нет.')}
                      </p>
                    )}
                    <small>{t('При одобрении сервер повторит проверку.')}</small>
                  </div>
                )}
                {chosen.review_note && (
                  <p className="review-comment">
                    <strong>{t('Комментарий администратора')}: </strong>
                    {chosen.review_note}
                  </p>
                )}
                <small>{format(chosen.created_at)}</small>
                {chosen.status === 'pending' && admin && (
                  <div className="review-actions">
                    <label>
                      {t('Комментарий администратора')}
                      <textarea
                        maxLength={1000}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                    </label>
                    <div className="workflow-actions">
                      <button
                        disabled={busy || dirty || !!conflicts.length}
                        className="button primary"
                        onClick={() =>
                          void action(
                            () =>
                              supabase!.rpc('review_schedule_request', {
                                request_id: chosen.id,
                                approve: true,
                                note: reviewNote,
                                expected_revision: revision,
                              }),
                            'Изменение опубликовано',
                          )
                        }
                      >
                        <Check size={17} />
                        {t('Одобрить и опубликовать')}
                      </button>
                      <button
                        disabled={busy || dirty || !reviewNote.trim()}
                        className="button secondary"
                        onClick={() =>
                          void action(
                            () =>
                              supabase!.rpc('review_schedule_request', {
                                request_id: chosen.id,
                                approve: false,
                                note: reviewNote,
                                expected_revision: revision,
                              }),
                            'Заявка возвращена с комментарием',
                          )
                        }
                      >
                        {t('Вернуть на доработку')}
                      </button>
                    </div>
                  </div>
                )}
                {chosen.status === 'pending' && chosen.author_id === profile.id && (
                  <button
                    disabled={busy || dirty}
                    className="text-button"
                    onClick={() =>
                      void action(
                        () => supabase!.rpc('withdraw_schedule_request', { request_id: chosen.id }),
                        'Заявка отозвана',
                      )
                    }
                  >
                    {t('Отозвать заявку')}
                  </button>
                )}
              </article>
            </div>
          )}
          <p className="workflow-footnote">
            {t('Показаны последние 200 заявок. Список обновляется автоматически.')}
          </p>
        </>
      )}
      {view === 'history' && (
        <div className="workflow-card history-list">
          {updates.map((u) => (
            <div className="history-row" key={u.revision}>
              <History size={20} />
              <div>
                <UpdateDescription update={u} data={data} />
                <small>
                  {format(u.created_at)} · {t(u.actor_label)}
                </small>
              </div>
              {admin && (
                <button
                  className="button secondary"
                  onClick={async () => {
                    setError('');
                    const result = await supabase!
                      .from('schedule_history')
                      .select('revision,payload')
                      .eq('revision', u.revision)
                      .single();
                    if (result.error) setError(t(workflowError(result.error)));
                    else {
                      setRestoreConfirmed(false);
                      setSnapshot(result.data);
                    }
                  }}
                >
                  {t('Открыть версию')}
                </button>
              )}
            </div>
          ))}
          <p className="workflow-footnote">{t('Показаны последние 50 публикаций.')}</p>
        </div>
      )}
      {snapshot && (
        <Modal
          title={`${t('Просмотр версии')} · ${snapshot.revision}`}
          onClose={() => setSnapshot(null)}
        >
          <section className="workflow-card snapshot">
            <div className="workflow-card-title">
              <h2>
                {t('Версия')} {snapshot.revision}
              </h2>
              <button autoFocus className="button secondary" onClick={() => setSnapshot(null)}>
                {t('Закрыть')}
              </button>
            </div>
            <p>{t('Недельный шаблон')}</p>
            <div className="snapshot-table">
              <table>
                <thead>
                  <tr>
                    <th>{t('Группа')}</th>
                    <th>{t('Занятие')}</th>
                    <th>{t('День')}</th>
                    <th>{t('Преподаватель')}</th>
                    <th>{t('Повторение')}</th>
                    <th>{t('Время')}</th>
                    <th>{t('Аудитория')}</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.payload.lessons.map((l) => (
                    <tr key={l.id}>
                      <td>{snapshot.payload.groups.find((g) => g.id === l.groupId)?.name}</td>
                      <td>{snapshot.payload.subjects.find((s) => s.id === l.subjectId)?.name}</td>
                      <td>{t(DAYS[l.day])}</td>
                      <td>
                        {lessonTeacher(l, snapshot.payload)?.name ?? t('Преподаватель не указан')}
                      </td>
                      <td>{t(FREQUENCIES[l.frequency])}</td>
                      <td>
                        {l.start}–{l.end}
                      </td>
                      <td>{l.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {t('Изменения отдельных дат')}: {snapshot.payload.exceptions?.length ?? 0}
            </p>
            {snapshot.payload.exceptions?.map((e) => (
              <p key={e.lessonId + e.originalDate}>
                {e.originalDate} →{' '}
                {e.cancelled ? t('Пара отменена') : `${e.date} ${e.start}–${e.end} · ${e.room}`}
              </p>
            ))}
            {snapshot.revision !== revision && (
              <label className="restore-confirmation">
                <input
                  type="checkbox"
                  checked={restoreConfirmed}
                  onChange={(e) => setRestoreConfirmed(e.target.checked)}
                />
                {t(
                  'Восстановить выбранную версию для всех пользователей? Текущая версия останется в истории.',
                )}
              </label>
            )}
            {error && (
              <p role="alert" className="warning">
                {error}
              </p>
            )}
            <div className="workflow-actions">
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    JSON.stringify(snapshot.payload, null, 2),
                    `tempo-v${snapshot.revision}.json`,
                    'application/json',
                  )
                }
              >
                {t('Скачать копию JSON')}
              </button>
              <button
                className="button primary"
                disabled={busy || dirty || !restoreConfirmed || snapshot.revision === revision}
                onClick={async () => {
                  if (
                    await action(
                      () =>
                        supabase!.rpc('restore_schedule_version', {
                          source_revision: snapshot.revision,
                          expected_revision: revision,
                        }),
                      'Версия восстановлена',
                    )
                  )
                    setSnapshot(null);
                }}
              >
                {t('Восстановить эту версию')}
              </button>
            </div>
          </section>
        </Modal>
      )}
    </section>
  );
}
