import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { db } from '@/lib/db/db'
import type { LogResultType, WorkoutLogRow } from '@/lib/db/types'
import { formatClock, parseClock } from '@/lib/format'
import { t } from '@/lib/i18n/t'
import { fromDisplayUnit, toDisplayUnit } from '@/lib/units/convert'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { addLog, updateLog } from './logRepo'

const RESULT_TYPES: Array<{ type: LogResultType; label: () => string }> = [
  { type: 'time', label: () => t('log.edit.time') },
  { type: 'rounds_reps', label: () => `${t('log.edit.rounds')}+${t('log.edit.reps')}` },
  { type: 'load', label: () => t('log.edit.load') },
  { type: 'none', label: () => t('log.edit.none') },
]

interface FormInitial {
  title: string
  date: string
  resultType: LogResultType
  time: string
  rounds: string
  reps: string
  load: string
  rx: boolean
  description: string
  notes: string
}

/** Loads the entry when editing, then hands stable initial values to the form. */
export function LogEntryFormScreen() {
  const { id } = useParams()
  const unit = useSettingsStore((s) => s.unit)
  const editing = Boolean(id)
  const existing = useLiveQuery(
    () => (id ? db.workoutLogs.get(id) : undefined),
    [id],
  )

  if (editing) {
    if (existing === undefined) return null // still loading
    if (!existing || existing.deletedAt) {
      return (
        <div className="flex min-h-full flex-col items-center justify-center gap-4">
          <p className="text-chalk-dim">{t('log.notFound')}</p>
          <Link to="/log" className="font-semibold text-work">
            {t('log.title')}
          </Link>
        </div>
      )
    }
    return (
      <LogForm
        key={existing.id}
        heading={t('log.editTitle')}
        initial={initialFromRow(existing, unit)}
        // Editing an auto-saved entry graduates it to a deliberate one so the
        // recent-timer prune can never reclaim a workout you took time to annotate.
        onSubmit={(patch) => updateLog(existing.id, { ...patch, source: 'manual' })}
      />
    )
  }

  return (
    <LogForm
      key="new"
      heading={t('log.new')}
      initial={{
        title: '',
        date: new Date().toISOString().slice(0, 10),
        resultType: 'time',
        time: '',
        rounds: '',
        reps: '',
        load: '',
        rx: true,
        description: '',
        notes: '',
      }}
      onSubmit={(entry) => addLog({ timerConfig: null, ...entry })}
    />
  )
}

function initialFromRow(row: WorkoutLogRow, unit: 'kg' | 'lbs'): FormInitial {
  return {
    title: row.title,
    date: row.performedAt,
    resultType: row.resultType,
    time: row.result.timeMs !== undefined ? formatClock(row.result.timeMs) : '',
    rounds: row.result.rounds !== undefined ? `${row.result.rounds}` : '',
    reps: row.result.reps !== undefined ? `${row.result.reps}` : '',
    load:
      row.result.loadKg !== undefined
        ? `${Math.round(toDisplayUnit(row.result.loadKg, unit) * 100) / 100}`
        : '',
    rx: row.rx,
    description: row.description,
    notes: row.notes ?? '',
  }
}

type LogSubmit = {
  performedAt: string
  title: string
  description: string
  resultType: LogResultType
  result: WorkoutLogRow['result']
  rx: boolean
  notes: string | null
}

function LogForm({
  heading,
  initial,
  onSubmit,
}: {
  heading: string
  initial: FormInitial
  onSubmit: (values: LogSubmit) => Promise<unknown>
}) {
  const navigate = useNavigate()
  const unit = useSettingsStore((s) => s.unit)

  const [title, setTitle] = useState(initial.title)
  const [date, setDate] = useState(initial.date)
  const [resultType, setResultType] = useState<LogResultType>(initial.resultType)
  const [time, setTime] = useState(initial.time)
  const [rounds, setRounds] = useState(initial.rounds)
  const [reps, setReps] = useState(initial.reps)
  const [load, setLoad] = useState(initial.load)
  const [rx, setRx] = useState(initial.rx)
  const [description, setDescription] = useState(initial.description)
  const [notes, setNotes] = useState(initial.notes)

  const save = () => {
    const result: WorkoutLogRow['result'] = {}
    if (resultType === 'time') {
      const ms = parseClock(time)
      if (ms !== null) result.timeMs = ms
    } else if (resultType === 'rounds_reps') {
      const r = Number.parseInt(rounds, 10)
      const extra = Number.parseInt(reps, 10)
      if (Number.isFinite(r)) result.rounds = r
      if (Number.isFinite(extra)) result.reps = extra
    } else if (resultType === 'load') {
      const value = Number.parseFloat(load)
      if (Number.isFinite(value)) result.loadKg = fromDisplayUnit(value, unit)
    }
    void onSubmit({
      performedAt: date,
      title: title.trim() || 'Workout',
      description: description.trim(),
      resultType,
      result,
      rx,
      notes: notes.trim() || null,
    }).then(() => navigate('/log'))
  }

  const field =
    'w-full rounded-xl bg-raised px-4 py-3 text-base text-chalk outline-none placeholder:text-chalk-dim'
  const label = 'text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim'

  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate('/log')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-chalk"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl tracking-wide text-chalk">{heading}</h1>
      </div>

      <label className="flex flex-col gap-2">
        <span className={label}>{t('log.edit.title')}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Fran, AMRAP 12, 5×5 squats…"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={label}>{t('log.edit.date')}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${field} [color-scheme:dark]`}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className={label}>{t('log.edit.result')}</span>
        <div className="flex gap-2">
          {RESULT_TYPES.map(({ type, label: rl }) => (
            <button
              key={type}
              type="button"
              onClick={() => setResultType(type)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                resultType === type
                  ? 'bg-chalk text-surface'
                  : 'bg-raised text-chalk-dim'
              }`}
            >
              {rl()}
            </button>
          ))}
        </div>
        {resultType === 'time' && (
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            inputMode="numeric"
            placeholder="17:42"
            className={field}
          />
        )}
        {resultType === 'rounds_reps' && (
          <div className="flex gap-2">
            <input
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
              inputMode="numeric"
              placeholder={t('log.edit.rounds')}
              className={field}
            />
            <input
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              inputMode="numeric"
              placeholder={`+ ${t('log.edit.reps')}`}
              className={field}
            />
          </div>
        )}
        {resultType === 'load' && (
          <input
            value={load}
            onChange={(e) => setLoad(e.target.value)}
            inputMode="decimal"
            placeholder={`${t('log.edit.load')} (${unit})`}
            className={field}
          />
        )}
      </div>

      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button
            key={`${v}`}
            type="button"
            onClick={() => setRx(v)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${
              rx === v ? 'bg-work text-surface' : 'bg-raised text-chalk-dim'
            }`}
          >
            {v ? t('log.rx') : t('log.scaled')}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-2">
        <span className={label}>{t('log.edit.description')}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('log.edit.descriptionPlaceholder')}
          rows={3}
          className={field}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={label}>{t('log.edit.notes')}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('log.edit.notesPlaceholder')}
          rows={2}
          className={field}
        />
      </label>

      <button
        type="button"
        onClick={save}
        className="mb-4 h-14 w-full rounded-2xl bg-work font-display text-xl tracking-wider text-surface"
      >
        {t('log.edit.save')}
      </button>
    </div>
  )
}
