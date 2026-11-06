import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import { supabase } from './supabase';
import { parseData, type Data } from './model';
import { type Profile } from './access';
import Workflow, { UpdateDescription, workflowError, type ScheduleUpdate } from './Workflow';
import { useI18n, languageNames, type Language } from './i18n';

export default function CloudApp() {
  const { t, language, setLanguage } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedule, setSchedule] = useState<Data | null>(null);
  const revision = useRef(0);
  const [revisionNumber, setRevisionNumber] = useState(0);
  const [incoming, setIncoming] = useState(false);
  const [updates, setUpdates] = useState<ScheduleUpdate[]>([]);
  const [updated, setUpdated] = useState(false);
  const dirtyRef = useRef(false);
  const [userSearch, setUserSearch] = useState('');
  const generation = useRef(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  async function reload() {
    if (!userId || !supabase) return;
    const token = generation.current;
    const [p, s, news] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('campus_schedule').select('payload,revision').eq('id', 1).single(),
      supabase.rpc('list_schedule_updates'),
    ]);
    if (token !== generation.current) return;
    if (p.error || s.error) throw new Error(t('Не удалось загрузить общее расписание.'));
    setProfile(p.data as Profile);
    if (!news.error) setUpdates(news.data as ScheduleUpdate[]);
    if (revision.current === Number(s.data.revision)) return;
    if (dirtyRef.current) {
      setIncoming(true);
      return;
    }
    const validated = parseData(JSON.stringify(s.data.payload));
    if (revision.current) setUpdated(true);
    revision.current = Number(s.data.revision);
    setRevisionNumber(revision.current);
    setSchedule(validated);
    setIncoming(false);
  }
  useEffect(() => {
    ++generation.current;
    revision.current = 0;
    dirtyRef.current = false;
    setProfile(null);
    setSchedule(null);
    setUsers(null);
    setError('');
    setMessage('');
    setDirty(false);
    setIncoming(false);
    setUpdated(false);
    setUpdates([]);
    if (!userId || !supabase) return;
    let loading = false;
    const refresh = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        await reload();
      } catch {
        setError(t('Не удалось загрузить общее расписание.'));
      } finally {
        loading = false;
      }
    };
    void refresh();
    const interval = setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      ++generation.current;
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [userId]);
  function trackDirty(value: boolean) {
    dirtyRef.current = value;
    setDirty(value);
  }

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Ошибка подключения'));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    if (dirty && !window.confirm(t('Есть неопубликованные изменения. Выйти без сохранения?')))
      return;
    const { error: e } = await supabase.auth.signOut({ scope: 'local' });
    if (e) setError(e.message);
  }

  async function publish(next: Data) {
    if (!supabase || profile?.role !== 'admin')
      throw new Error(t('Нет прав на изменение расписания'));
    parseData(JSON.stringify(next));
    const { data, error: e } = await supabase.rpc('save_campus_schedule', {
      next_payload: next,
      expected_revision: revision.current,
    });
    if (e)
      throw new Error(
        e.code === 'P0001'
          ? t('Расписание изменилось. Сохраните копию своих правок и обновите страницу.')
          : t(workflowError(e)),
      );
    revision.current = Number(data);
    setRevisionNumber(revision.current);
    setIncoming(false);
    setSchedule(next);
  }

  async function loadUsers() {
    if (!supabase || profile?.role !== 'admin') return;
    setError('');
    const result = await supabase.rpc('list_tempo_accounts');
    if (result.error) setError(result.error.message);
    else setUsers(result.data as Profile[]);
  }

  async function assign(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!supabase || busy) return;
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    const { error: e } = await supabase.rpc('assign_tempo_role', {
      target_user: id,
      next_role: values.get('role'),
      linked_teacher: values.get('teacher') || null,
      linked_group: values.get('group') || null,
    });
    setBusy(false);
    if (e) setError(e.message);
    else {
      setMessage(t('Роль сохранена'));
      await loadUsers();
    }
  }

  const languages = (
    <select
      aria-label={t('Язык интерфейса')}
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
    >
      {Object.entries(languageNames).map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
  if (!session)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-brand">tempo.</div>
          {languages}
          <h1>{t('Войти в Tempo')}</h1>
          <p>{t('Одно расписание для студентов и преподавателей.')}</p>
          {!ready ? (
            <p role="status">{t('Загрузка…')}</p>
          ) : (
            <form onSubmit={authenticate}>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                {t('Пароль')}
                <input
                  type="password"
                  minLength={8}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="button primary" disabled={busy}>
                {t(busy ? 'Загрузка…' : 'Войти')}
              </button>
            </form>
          )}
          <p>
            {t(
              'Учётную запись выдаёт администратор. Роль преподавателя связывается с вашим именем в справочнике.',
            )}
          </p>
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
        </section>
      </main>
    );
  if (!profile || !schedule)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Tempo</h1>
          <p role={error ? 'alert' : 'status'}>{error || t('Загрузка…')}</p>
          <button className="button secondary" onClick={() => window.location.reload()}>
            {t('Обновить')}
          </button>
          <button className="text-button" onClick={signOut}>
            {t('Выйти')}
          </button>
        </section>
      </main>
    );

  const accountBar = (
    <section className="account-bar">
      <div>
        <strong>
          {t(
            profile.role === 'admin'
              ? 'Администратор'
              : profile.role === 'teacher'
                ? 'Преподаватель'
                : 'Студент',
          )}
        </strong>
        <span>{session.user.email}</span>
      </div>
      <div className="account-actions">
        {profile.role === 'admin' && (
          <button className="button secondary" onClick={loadUsers}>
            {t('Управление ролями')}
          </button>
        )}
        <button className="button secondary" onClick={signOut}>
          {t('Выйти')}
        </button>
      </div>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {incoming && (
        <p className="warning" role="status">
          {t(
            'Есть новая опубликованная версия. Сохраните копию черновика перед обновлением страницы.',
          )}
        </p>
      )}
      {updated && !incoming && (
        <div className="schedule-update" role="status">
          <div>
            <strong>{t('Расписание обновилось автоматически')}</strong>
            {updates[0] && schedule && <UpdateDescription update={updates[0]} data={schedule} />}
          </div>
          <button className="text-button" onClick={() => setUpdated(false)}>
            {t('Понятно')}
          </button>
        </div>
      )}
      {users && (
        <section className="roles-panel">
          <h2>{t('Управление ролями')}</h2>
          <p>
            {t('Найдите пользователя по имени или email. Изменения роли применятся автоматически.')}
          </p>
          <label>
            {t('Найти пользователя')}
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </label>
          {users
            .filter((u) =>
              [u.display_name, u.email, u.id]
                .join(' ')
                .toLocaleLowerCase()
                .includes(userSearch.toLocaleLowerCase()),
            )
            .map((u) => (
              <form key={u.id} onSubmit={(e) => assign(e, u.id)}>
                <div>
                  <strong>{u.display_name || u.id}</strong>
                  <small>{u.email}</small>
                </div>
                <label>
                  {t('Роль')}
                  <select name="role" defaultValue={u.role} disabled={u.id === profile.id}>
                    <option value="student">{t('Студент')}</option>
                    <option value="teacher">{t('Преподаватель')}</option>
                    <option value="admin">{t('Администратор')}</option>
                  </select>
                </label>
                <label>
                  {t('Преподаватель')}
                  <select name="teacher" defaultValue={u.teacher_id || ''}>
                    <option value="">—</option>
                    {schedule.teachers.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('Группа')}
                  <select name="group" defaultValue={u.group_id || ''}>
                    <option value="">—</option>
                    {schedule.groups.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button primary" disabled={busy || u.id === profile.id}>
                  {t('Сохранить')}
                </button>
              </form>
            ))}
          {message && <p role="status">{message}</p>}
          <button className="text-button" onClick={() => setUsers(null)}>
            {t('Закрыть')}
          </button>
        </section>
      )}
    </section>
  );
  return (
    <App
      key={profile.id + profile.role + profile.teacher_id}
      cloud={{
        data: schedule,
        profile,
        publish,
        accountBar,
        onDirty: trackDirty,
        revision: revisionNumber,
        workflow: (view) => (
          <Workflow
            view={view}
            data={schedule}
            profile={profile}
            revision={revisionNumber}
            dirty={dirty}
            onChanged={reload}
          />
        ),
      }}
    />
  );
}
