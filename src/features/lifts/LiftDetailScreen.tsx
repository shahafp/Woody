import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { db } from '@/lib/db/db'
import { t } from '@/lib/i18n/t'
import { fromDisplayUnit, toDisplayUnit } from '@/lib/units/convert'
import { formatWeight, roundToPlate } from '@/lib/units/plates'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { addMax, deleteLift, deleteMax, liveMaxesFor } from './liftsRepo'
import { buildPercentTable, percentOf } from './percentTable'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LiftDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const unit = useSettingsStore((s) => s.unit)
  const incKg = useSettingsStore((s) => s.plateIncrementKg)
  const incLbs = useSettingsStore((s) => s.plateIncrementLbs)

  const lift = useLiveQuery(() => db.lifts.get(id), [id])
  const maxes = useLiveQuery(() => liveMaxesFor(id), [id])

  const [newMax, setNewMax] = useState('')
  const [customPercent, setCustomPercent] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)

  useEffect(() => {
    if (!deleteArmed) return
    const timer = setTimeout(() => setDeleteArmed(false), 3000)
    return () => clearTimeout(timer)
  }, [deleteArmed])

  if (lift === undefined || maxes === undefined) return null
  if (!lift || lift.deletedAt) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4">
        <p className="text-chalk-dim">{t('lift.notFound')}</p>
        <Link to="/lifts" className="font-semibold text-work">
          {t('lifts.title')}
        </Link>
      </div>
    )
  }

  const current = maxes[0] ?? null
  const round = (kg: number) => formatWeight(roundToPlate(kg, unit, incKg, incLbs))

  const saveMax = () => {
    const value = Number.parseFloat(newMax)
    if (!Number.isFinite(value) || value <= 0) return
    void addMax(id, fromDisplayUnit(value, unit), todayIso())
    setNewMax('')
  }

  const customPct = Number.parseFloat(customPercent)
  const customValid = Number.isFinite(customPct) && customPct > 0 && customPct <= 200

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate('/lifts')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-chalk"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl tracking-wide text-chalk">
          {lift.name.toUpperCase()}
        </h1>
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <span className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
            {t('lift.current1rm')}
          </span>
          <div className="font-display text-6xl text-work">
            {current ? (
              <>
                {formatWeight(
                  Math.round(toDisplayUnit(current.valueKg, unit) * 100) / 100,
                )}
                <span className="ml-2 text-2xl text-chalk-dim">{unit}</span>
              </>
            ) : (
              <span className="text-chalk-dim">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={newMax}
          onChange={(e) => setNewMax(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveMax()}
          inputMode="decimal"
          placeholder={`${t('lift.new1rm')} (${unit})`}
          className="min-w-0 flex-1 rounded-xl bg-raised px-4 py-3 text-base text-chalk outline-none placeholder:text-chalk-dim"
        />
        <button
          type="button"
          onClick={saveMax}
          className="rounded-xl bg-work px-5 font-semibold text-surface"
        >
          {t('lift.save')}
        </button>
      </div>

      {current && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
            {t('lift.percentTable')}
          </h2>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-raised px-4 py-3">
            <input
              value={customPercent}
              onChange={(e) => setCustomPercent(e.target.value)}
              inputMode="decimal"
              placeholder={t('lift.customPercent')}
              className="w-24 bg-transparent text-base text-chalk outline-none placeholder:text-chalk-dim"
            />
            {customValid && (
              <span className="ml-auto font-display text-2xl text-work">
                {round(percentOf(current.valueKg, customPct))}
                <span className="ml-1 text-sm text-chalk-dim">{unit}</span>
              </span>
            )}
          </div>
          <div className="mt-2 overflow-hidden rounded-xl bg-raised">
            {buildPercentTable(current.valueKg).map((row, i) => (
              <div
                key={row.percent}
                className={`flex items-center justify-between px-4 py-2.5 ${
                  i > 0 ? 'border-t border-edge' : ''
                }`}
              >
                <span
                  className={`font-semibold ${row.percent === 100 ? 'text-work' : 'text-chalk-dim'}`}
                >
                  {row.percent}%
                </span>
                <span className="font-display text-xl text-chalk">
                  {round(row.weightKg)}
                  <span className="ml-1 text-sm text-chalk-dim">{unit}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
          {t('lift.history')}
        </h2>
        {maxes.length === 0 ? (
          <p className="mt-3 text-sm text-chalk-dim">{t('lift.noHistory')}</p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl bg-raised">
            {maxes.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center justify-between px-4 py-2.5 ${
                  i > 0 ? 'border-t border-edge' : ''
                }`}
              >
                <span className="text-sm text-chalk-dim">{m.recordedAt}</span>
                <span className="flex items-center gap-3">
                  <span className="font-display text-xl text-chalk">
                    {formatWeight(Math.round(toDisplayUnit(m.valueKg, unit) * 100) / 100)}
                    <span className="ml-1 text-sm text-chalk-dim">{unit}</span>
                  </span>
                  <button
                    type="button"
                    aria-label="Delete entry"
                    onClick={() => void deleteMax(m.id)}
                    className="text-chalk-dim active:text-alarm"
                  >
                    <X size={16} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 pb-4">
        <button
          type="button"
          onClick={() => {
            if (deleteArmed) {
              void deleteLift(id)
              navigate('/lifts')
            } else {
              setDeleteArmed(true)
            }
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ${
            deleteArmed ? 'bg-alarm text-surface' : 'text-alarm/80'
          }`}
        >
          <Trash2 size={16} />
          {deleteArmed ? t('lifts.deleteConfirm') : t('lifts.delete')}
        </button>
      </div>
    </div>
  )
}
