import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { t } from '@/lib/i18n/t'
import { formatWeight, roundToPlate } from '@/lib/units/plates'
import { currentMaxes, liveLifts } from '@/features/lifts/liftsRepo'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { CompactStepper } from '@/features/timer/components/CompactStepper'
import { computeSheet, type SheetLiftInfo } from './computeSheet'
import { addBlock, getSheetForDate, removeBlock, todayIso } from './sheetRepo'

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function WodSheetScreen() {
  const unit = useSettingsStore((s) => s.unit)
  const incKg = useSettingsStore((s) => s.plateIncrementKg)
  const incLbs = useSettingsStore((s) => s.plateIncrementLbs)

  const date = todayIso()
  const sheet = useLiveQuery(() => getSheetForDate(date), [date])
  const lifts = useLiveQuery(liveLifts, [])
  const maxes = useLiveQuery(currentMaxes, [])

  const [adding, setAdding] = useState(false)
  const [liftId, setLiftId] = useState('')
  const [sets, setSets] = useState(5)
  const [reps, setReps] = useState(3)
  const [percent, setPercent] = useState(75)

  const liftInfo = new Map<string, SheetLiftInfo>(
    (lifts ?? []).map((l) => [
      l.id,
      { name: l.name, oneRmKg: maxes?.get(l.id)?.valueKg ?? null },
    ]),
  )
  const computed = computeSheet(sheet?.blocks ?? [], liftInfo)

  const submit = () => {
    const chosen = liftId || lifts?.[0]?.id
    if (!chosen) return
    void addBlock(date, { liftId: chosen, sets, reps, percent })
    setAdding(false)
  }

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="flex min-h-full flex-col">
      <h1 className="font-display text-3xl tracking-wide text-chalk">
        {t('wod.title')}
      </h1>
      <p className="mt-1 text-sm text-chalk-dim">{dateLabel}</p>

      <div className="mt-5 flex flex-col gap-3">
        {computed.map(({ block, liftName, weightKg }) => (
          <div key={block.id} className="rounded-2xl bg-raised p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold text-chalk">{liftName}</div>
                <div className="mt-0.5 text-sm text-chalk-dim">
                  {block.sets} × {block.reps} @ {block.percent}%
                </div>
              </div>
              <button
                type="button"
                aria-label="Remove block"
                onClick={() => sheet && void removeBlock(sheet.id, block.id)}
                className="text-chalk-dim active:text-alarm"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-2">
              {weightKg === null ? (
                <span className="text-sm text-rest">
                  {t('wod.noMax')} ·{' '}
                  <Link to={`/lifts/${block.liftId}`} className="font-semibold underline">
                    {t('wod.setMax')}
                  </Link>
                </span>
              ) : (
                <span className="font-display text-5xl text-work">
                  {formatWeight(roundToPlate(weightKg, unit, incKg, incLbs))}
                  <span className="ml-2 text-xl text-chalk-dim">{unit}</span>
                </span>
              )}
            </div>
          </div>
        ))}

        {computed.length === 0 && !adding && (
          <p className="rounded-2xl border border-dashed border-edge p-6 text-center text-sm text-chalk-dim">
            {t('wod.empty')}
          </p>
        )}
      </div>

      <div className="mt-4 pb-4">
        {adding ? (
          <div className="flex flex-col gap-4 rounded-2xl bg-raised p-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
                {t('wod.lift')}
              </span>
              <select
                value={liftId || lifts?.[0]?.id || ''}
                onChange={(e) => setLiftId(e.target.value)}
                className="appearance-none rounded-xl bg-edge px-4 py-3 text-base text-chalk outline-none"
              >
                {lifts?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <CompactStepper
              label={t('wod.sets')}
              display={`${sets}`}
              onDecrement={() => setSets((v) => clampInt(v - 1, 1, 20))}
              onIncrement={() => setSets((v) => clampInt(v + 1, 1, 20))}
            />
            <CompactStepper
              label={t('wod.reps')}
              display={`${reps}`}
              onDecrement={() => setReps((v) => clampInt(v - 1, 1, 50))}
              onIncrement={() => setReps((v) => clampInt(v + 1, 1, 50))}
            />
            <CompactStepper
              label={t('wod.percent')}
              display={`${percent}%`}
              onDecrement={() => setPercent((v) => clampInt(v - 5, 5, 120))}
              onIncrement={() => setPercent((v) => clampInt(v + 5, 5, 120))}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submit}
                className="flex-1 rounded-xl bg-work py-3 font-semibold text-surface"
              >
                {t('wod.add')}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-xl bg-edge px-5 font-semibold text-chalk-dim"
              >
                {t('wod.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-sm font-semibold text-chalk-dim active:bg-raised"
          >
            <Plus size={16} /> {t('wod.addBlock')}
          </button>
        )}
      </div>
    </div>
  )
}
