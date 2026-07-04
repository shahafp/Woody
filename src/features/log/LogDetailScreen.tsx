import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { db } from '@/lib/db/db'
import { t } from '@/lib/i18n/t'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { describe } from '@/features/timer/engine/presets'
import { deleteLog } from './logRepo'
import { resultLabel } from './LogListScreen'

export function LogDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const unit = useSettingsStore((s) => s.unit)
  const log = useLiveQuery(() => db.workoutLogs.get(id), [id])
  const [deleteArmed, setDeleteArmed] = useState(false)

  useEffect(() => {
    if (!deleteArmed) return
    const timer = setTimeout(() => setDeleteArmed(false), 3000)
    return () => clearTimeout(timer)
  }, [deleteArmed])

  if (log === undefined) return null
  if (!log || log.deletedAt) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4">
        <p className="text-chalk-dim">{t('log.notFound')}</p>
        <Link to="/log" className="font-semibold text-work">
          {t('log.title')}
        </Link>
      </div>
    )
  }

  const result = resultLabel(log, unit)

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate('/log')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-chalk"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl tracking-wide text-chalk">
          {(log.title || 'Workout').toUpperCase()}
        </h1>
        <Link
          to={`/log/${id}/edit`}
          aria-label={t('log.edit')}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-raised px-4 text-sm font-semibold text-chalk active:bg-edge"
        >
          <Pencil size={15} /> {t('log.edit')}
        </Link>
      </div>

      <div className="mt-2 text-sm text-chalk-dim">
        {log.performedAt}
        <span
          className={`ml-2 rounded px-1.5 py-0.5 font-bold ${
            log.rx ? 'bg-work/15 text-work' : 'bg-edge text-chalk-dim'
          }`}
        >
          {log.rx ? t('log.rx') : t('log.scaled')}
        </span>
      </div>

      {result && (
        <div className="mt-6">
          <span className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
            {t('log.edit.result')}
          </span>
          <div className="font-display text-6xl text-work">{result}</div>
        </div>
      )}

      {log.timerConfig && (
        <p className="mt-4 text-sm text-chalk-dim">{describe(log.timerConfig)}</p>
      )}

      {log.description && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
            {t('log.edit.description')}
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-raised p-4 text-base text-chalk">
            {log.description}
          </p>
        </section>
      )}

      {log.notes && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
            {t('log.edit.notes')}
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-raised p-4 text-base text-chalk">
            {log.notes}
          </p>
        </section>
      )}

      <div className="mt-10 pb-4">
        <button
          type="button"
          onClick={() => {
            if (deleteArmed) {
              void deleteLog(id)
              navigate('/log')
            } else {
              setDeleteArmed(true)
            }
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ${
            deleteArmed ? 'bg-alarm text-surface' : 'text-alarm/80'
          }`}
        >
          <Trash2 size={16} />
          {deleteArmed ? t('log.deleteConfirm') : t('log.delete')}
        </button>
      </div>
    </div>
  )
}
