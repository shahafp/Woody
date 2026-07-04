import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import type { WorkoutLogRow } from '@/lib/db/types'
import { formatClock } from '@/lib/format'
import { t } from '@/lib/i18n/t'
import { toDisplayUnit } from '@/lib/units/convert'
import { formatWeight } from '@/lib/units/plates'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { liveLogs } from './logRepo'

export function resultLabel(
  log: WorkoutLogRow,
  unit: 'kg' | 'lbs',
): string | null {
  switch (log.resultType) {
    case 'time':
      return log.result.timeMs !== undefined ? formatClock(log.result.timeMs) : null
    case 'rounds_reps': {
      const { rounds, reps } = log.result
      if (rounds === undefined) return null
      return reps ? `${rounds} rds + ${reps}` : `${rounds} rds`
    }
    case 'load':
      return log.result.loadKg !== undefined
        ? `${formatWeight(Math.round(toDisplayUnit(log.result.loadKg, unit) * 100) / 100)} ${unit}`
        : null
    case 'none':
      return null
  }
}

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

export function LogListScreen() {
  const unit = useSettingsStore((s) => s.unit)
  const logs = useLiveQuery(liveLogs, [])

  const groups: Array<{ month: string; entries: WorkoutLogRow[] }> = []
  for (const log of logs ?? []) {
    const month = monthLabel(log.performedAt)
    const group = groups[groups.length - 1]
    if (group && group.month === month) group.entries.push(log)
    else groups.push({ month, entries: [log] })
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide text-chalk">
          {t('log.title')}
        </h1>
        <Link
          to="/log/new"
          className="flex items-center gap-1.5 rounded-full bg-raised px-4 py-2 text-sm font-semibold text-chalk"
        >
          <Plus size={16} /> {t('log.add')}
        </Link>
      </div>

      {logs && logs.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-edge p-6 text-center text-sm text-chalk-dim">
          {t('log.empty')}
        </p>
      )}

      {groups.map(({ month, entries }) => (
        <section key={month} className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
            {month}
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {entries.map((log) => {
              const result = resultLabel(log, unit)
              return (
                <Link
                  key={log.id}
                  to={`/log/${log.id}`}
                  className="flex items-center justify-between rounded-xl bg-raised px-4 py-3.5 active:bg-edge"
                >
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-chalk">
                      {log.title || 'Workout'}
                    </div>
                    <div className="mt-0.5 text-xs text-chalk-dim">
                      {log.performedAt}
                      {log.rx && (
                        <span className="ml-2 rounded bg-work/15 px-1.5 py-0.5 font-bold text-work">
                          {t('log.rx')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    {result && (
                      <span className="font-display text-xl text-work">{result}</span>
                    )}
                    <ChevronRight size={18} className="text-chalk-dim" />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
