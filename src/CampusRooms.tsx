import { useState } from 'react';
import { useI18n } from './i18n';
import {
  fits,
  parseData,
  roomKey,
  groupNames,
  DAYS,
  type Data,
  type Room,
  type Lesson,
} from './model';
export default function CampusRooms({
  data,
  editable,
  save,
}: {
  data: Data;
  editable: boolean;
  save: (next: Data) => void;
}) {
  const { t } = useI18n();
  const rooms = data.rooms ?? [];
  const names = [
    ...new Set([...rooms.map((r) => r.name), ...data.lessons.map((l) => l.room)]),
  ].sort();
  const [selected, select] = useState(''),
    [lessonId, pick] = useState(''),
    [error, setError] = useState('');
  const room = rooms.find((r) => roomKey(r.name) === roomKey(selected));
  const lesson = data.lessons.find((l) => l.id === lessonId);
  const title = (l: Lesson) =>
    [
      t(DAYS[l.day]),
      l.start,
      data.subjects.find((s) => s.id === l.subjectId)?.name,
      groupNames(l, data),
    ].join(' · ');
  function revised(changes: Map<string, string>) {
    const next = {
      ...data,
      lessons: data.lessons.map((l) =>
        changes.has(l.id) ? { ...l, room: changes.get(l.id)! } : l,
      ),
    };
    try {
      parseData(JSON.stringify(next));
      return next;
    } catch {
      return null;
    }
  }
  function saveRoom(form: HTMLFormElement) {
    const f = new FormData(form);
    const next: Room = {
      name: String(f.get('name')).trim(),
      seats: Number(f.get('seats')),
      computers: Number(f.get('computers')),
      screen: f.has('screen'),
    };
    const updated = {
      ...data,
      rooms: [...rooms.filter((r) => roomKey(r.name) !== roomKey(next.name)), next],
    };
    try {
      parseData(JSON.stringify(updated));
      save(updated);
      select(next.name);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="workflow-page">
      <h1>{t('Аудитории')}</h1>
      <p>{t('Внесите проверенные сведения об аудиториях для подбора по местам и оборудованию.')}</p>
      <section className="workflow-card">
        <label>
          {t('Аудитория')}
          <select value={selected} onChange={(e) => select(e.target.value)}>
            <option value="">—</option>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        {editable ? (
          <form
            className="form"
            key={selected}
            onSubmit={(e) => {
              e.preventDefault();
              saveRoom(e.currentTarget);
            }}
          >
            <label>
              {t('Аудитория')}
              <input
                required
                maxLength={60}
                name="name"
                defaultValue={selected}
                readOnly={!!selected}
              />
            </label>
            <div className="form-row">
              {(['seats', 'computers'] as const).map((k) => (
                <label key={k}>
                  {t(k === 'seats' ? 'Вместимость' : 'Компьютеры')}
                  <input
                    required
                    type="number"
                    min={k === 'seats' ? 1 : 0}
                    name={k}
                    defaultValue={room?.[k]}
                  />
                </label>
              ))}
            </div>
            <label>
              <input type="checkbox" name="screen" defaultChecked={room?.screen} />
              {t('Экран')}
            </label>
            <button className="button secondary">{t('Сохранить')}</button>
          </form>
        ) : (
          selected && (
            <p>
              {room
                ? `${t('Вместимость')}: ${room.seats} · ${t('Компьютеры')}: ${room.computers} · ${t('Экран')}: ${room.screen ? '✓' : '—'}`
                : t('Характеристики не указаны')}
            </p>
          )
        )}
      </section>
      {error && <p role="alert">{t(error)}</p>}
      {editable && (
        <section className="workflow-card">
          <h2>{t('Подбор аудитории')}</h2>
          <select aria-label={t('Занятие')} value={lessonId} onChange={(e) => pick(e.target.value)}>
            <option value="">—</option>
            {data.lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {title(l)}
              </option>
            ))}
          </select>
          {lesson &&
            rooms
              .filter((r) => fits(lesson, r) && roomKey(r.name) !== roomKey(lesson.room))
              .sort(
                (a, b) =>
                  (!lesson.computers ? Number(!!a.computers) - Number(!!b.computers) : 0) ||
                  a.seats - b.seats,
              )
              .map((r) => {
                let next = revised(new Map([[lesson.id, r.name]]));
                let swap = '';
                if (!next) {
                  const blockers = data.lessons.filter(
                    (l) =>
                      l.id !== lesson.id &&
                      roomKey(l.room) === roomKey(r.name) &&
                      l.day === lesson.day &&
                      l.start < lesson.end &&
                      l.end > lesson.start &&
                      (l.frequency === lesson.frequency ||
                        l.frequency === 'every' ||
                        lesson.frequency === 'every'),
                  );
                  if (blockers.length === 1) {
                    const other = blockers[0];
                    for (const alt of rooms
                      .filter((a) => a !== r && fits(other, a))
                      .sort((a, b) => a.seats - b.seats)) {
                      next = revised(
                        new Map([
                          [lesson.id, r.name],
                          [other.id, alt.name],
                        ]),
                      );
                      if (next) {
                        swap = title(other) + ' → ' + alt.name;
                        break;
                      }
                    }
                  }
                }
                return (
                  <article key={r.name}>
                    <strong>{r.name}</strong> · {t('Вместимость')} {r.seats} · {t('Компьютеры')}{' '}
                    {r.computers}
                    {swap && <p>{swap}</p>}{' '}
                    <button
                      className="button secondary"
                      disabled={!next}
                      onClick={() => next && save(next)}
                    >
                      {t(next ? 'Применить к черновику' : 'Недоступно')}
                    </button>
                  </article>
                );
              })}
        </section>
      )}
      <section className="workflow-card">
        <h2>{t('Направления УрГУ')}</h2>
        <p>
          <a href="https://urdu.uz/uz/site/active?id=462">Bakalavriat</a> · 60610300 Kompyuter
          injiniringi · 60510100 Biologiya · 60530500 Fizika · 60540100 Matematika
        </p>
        <p>
          <a href="https://urdu.uz/uz/site/active?id=432">Magistratura</a> · 70610301 Kompyuter
          injiniringi · 70510101 Biologiya · 70530501 Fizika · 70540103 Aktuar va moliyaviy
          matematika
        </p>
      </section>
    </section>
  );
}
