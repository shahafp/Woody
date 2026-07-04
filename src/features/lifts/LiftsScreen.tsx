import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { t } from '@/lib/i18n/t'
import { formatWeight, roundToPlate } from '@/lib/units/plates'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { addLift, currentMaxes, liveLifts, seedLiftsIfEmpty } from './liftsRepo'

export function LiftsScreen() {
  const unit = useSettingsStore((s) => s.unit)
  const incKg = useSettingsStore((s) => s.plateIncrementKg)
  const incLbs = useSettingsStore((s) => s.plateIncrementLbs)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    void seedLiftsIfEmpty()
  }, [])

  const lifts = useLiveQuery(liveLifts, [])
  const maxes = useLiveQuery(currentMaxes, [])

  const submit = () => {
    if (name.trim()) {
      void addLift(name)
      setName('')
      setAdding(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <h1 className="font-display text-3xl tracking-wide text-chalk">
        {t('lifts.title')}
      </h1>

      <div className="mt-5 flex flex-col gap-2">
        {lifts?.map((lift) => {
          const max = maxes?.get(lift.id)
          return (
            <Link
              key={lift.id}
              to={`/lifts/${lift.id}`}
              className="flex items-center justify-between rounded-xl bg-raised px-4 py-4 active:bg-edge"
            >
              <span className="text-base font-semibold text-chalk">{lift.name}</span>
              <span className="flex items-center gap-2">
                {max ? (
                  <span className="font-display text-xl text-work">
                    {formatWeight(roundToPlate(max.valueKg, unit, incKg, incLbs))}
                    <span className="ml-1 text-sm text-chalk-dim">{unit}</span>
                  </span>
                ) : (
                  <span className="text-sm text-chalk-dim">{t('lifts.noMax')}</span>
                )}
                <ChevronRight size={18} className="text-chalk-dim" />
              </span>
            </Link>
          )
        })}
        {lifts && lifts.length === 0 && (
          <p className="py-8 text-center text-chalk-dim">{t('lifts.empty')}</p>
        )}
      </div>

      <div className="mt-4">
        {adding ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={t('lifts.addPlaceholder')}
              className="min-w-0 flex-1 rounded-xl bg-raised px-4 py-3 text-base text-chalk outline-none placeholder:text-chalk-dim"
            />
            <button
              type="button"
              onClick={submit}
              className="rounded-xl bg-chalk px-4 font-semibold text-surface"
            >
              {t('lift.save')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-sm font-semibold text-chalk-dim active:bg-raised"
          >
            <Plus size={16} /> {t('lifts.add')}
          </button>
        )}
      </div>
    </div>
  )
}
