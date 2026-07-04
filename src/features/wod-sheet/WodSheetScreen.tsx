import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { WodSheetBlock } from '@/lib/db/types'
import { t } from '@/lib/i18n/t'
import { formatWeight, roundToPlate } from '@/lib/units/plates'
import { currentMaxes, liveLifts } from '@/features/lifts/liftsRepo'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { BlockEditor } from './BlockEditor'
import {
  computeSheet,
  type ComputedMovement,
  type SheetLiftInfo,
} from './computeSheet'
import { addBlock, clearSheet, getSheetForDate, removeBlock, todayIso, updateBlock } from './sheetRepo'

export function WodSheetScreen() {
  const unit = useSettingsStore((s) => s.unit)
  const incKg = useSettingsStore((s) => s.plateIncrementKg)
  const incLbs = useSettingsStore((s) => s.plateIncrementLbs)

  const date = todayIso()
  const sheet = useLiveQuery(() => getSheetForDate(date), [date])
  const lifts = useLiveQuery(liveLifts, [])
  const maxes = useLiveQuery(currentMaxes, [])

  // null = not editing; 'new' = adding; otherwise the id of the block being edited
  const [editing, setEditing] = useState<string | null>(null)
  const [resetArmed, setResetArmed] = useState(false)

  useEffect(() => {
    if (!resetArmed) return
    const timer = setTimeout(() => setResetArmed(false), 3000)
    return () => clearTimeout(timer)
  }, [resetArmed])

  const liftInfo = new Map<string, SheetLiftInfo>(
    (lifts ?? []).map((l) => [
      l.id,
      { name: l.name, oneRmKg: maxes?.get(l.id)?.valueKg ?? null },
    ]),
  )
  const computed = computeSheet(sheet?.blocks ?? [], liftInfo)

  const fmtWeight = (kg: number | null) =>
    kg === null ? null : formatWeight(roundToPlate(kg, unit, incKg, incLbs))

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const editingBlock: WodSheetBlock | null =
    editing && editing !== 'new'
      ? (sheet?.blocks.find((b) => b.id === editing) ?? null)
      : null

  const saveBlock = (fields: Omit<WodSheetBlock, 'id'>) => {
    if (editing === 'new') void addBlock(date, fields)
    else if (editing && sheet) void updateBlock(sheet.id, editing, fields)
    setEditing(null)
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-chalk">
            {t('wod.title')}
          </h1>
          <p className="mt-1 text-sm text-chalk-dim">{dateLabel}</p>
        </div>
        {computed.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (resetArmed) {
                if (sheet) void clearSheet(sheet.id)
                setResetArmed(false)
                setEditing(null)
              } else {
                setResetArmed(true)
              }
            }}
            className={`mt-1 flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${
              resetArmed ? 'bg-alarm text-surface' : 'bg-raised text-chalk-dim active:bg-edge'
            }`}
          >
            <RotateCcw size={15} />
            {resetArmed ? t('wod.resetConfirm') : t('wod.reset')}
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {computed.map((cb) => (
          <div key={cb.block.id} className="rounded-2xl bg-raised p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {(cb.isSuperset || cb.label) && (
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-work">
                    {cb.isSuperset
                      ? `${t('wod.superset')}${cb.label ? ` ${cb.label}` : ''}`
                      : cb.label}
                  </div>
                )}
              </div>
              {editing !== cb.block.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Edit block"
                    onClick={() => setEditing(cb.block.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-chalk-dim active:bg-edge"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove block"
                    onClick={() => sheet && void removeBlock(sheet.id, cb.block.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-chalk-dim active:text-alarm"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>

            {editing === cb.block.id ? (
              <div className="mt-2">
                <BlockEditor
                  lifts={lifts ?? []}
                  initial={editingBlock}
                  onSave={saveBlock}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <div className={cb.isSuperset || cb.label ? 'mt-2 flex flex-col gap-4' : 'flex flex-col gap-4'}>
                {cb.movements.map((mv, i) => (
                  <MovementView
                    key={i}
                    movement={mv}
                    prefix={cb.isSuperset ? `${cb.label ?? ''}${i + 1}` : null}
                    fmtWeight={fmtWeight}
                    unit={unit}
                  />
                ))}
              </div>
            )}

            {editing !== cb.block.id && (cb.tempo || cb.note) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk-dim">
                {cb.tempo && (
                  <span>
                    tempo <span className="font-semibold text-chalk">{cb.tempo}</span>
                  </span>
                )}
                {cb.note && <span className="italic">“{cb.note}”</span>}
              </div>
            )}
          </div>
        ))}

        {computed.length === 0 && editing === null && (
          <p className="rounded-2xl border border-dashed border-edge p-6 text-center text-sm text-chalk-dim">
            {t('wod.empty')}
          </p>
        )}
      </div>

      <div className="mt-4 pb-4">
        {editing === 'new' ? (
          <BlockEditor
            lifts={lifts ?? []}
            initial={null}
            onSave={saveBlock}
            onCancel={() => setEditing(null)}
          />
        ) : editing === null ? (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-sm font-semibold text-chalk-dim active:bg-raised"
          >
            <Plus size={16} /> {t('wod.addBlock')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function MovementView({
  movement,
  prefix,
  fmtWeight,
  unit,
}: {
  movement: ComputedMovement
  prefix: string | null
  fmtWeight: (kg: number | null) => string | null
  unit: 'kg' | 'lbs'
}) {
  const first = movement.sets[0]
  const noMax = first && first.weightKg === null

  return (
    <div>
      <div className="flex items-baseline gap-2">
        {prefix && (
          <span className="shrink-0 rounded bg-work/15 px-1.5 py-0.5 text-xs font-bold text-work">
            {prefix}
          </span>
        )}
        <span className="text-base font-semibold text-chalk">{movement.name}</span>
      </div>

      {noMax ? (
        <div className="mt-0.5 text-sm text-rest">
          {t('wod.noMax')} ·{' '}
          <Link to={`/lifts/${movement.liftId}`} className="font-semibold underline">
            {t('wod.setMax')}
          </Link>
        </div>
      ) : movement.uniform && first ? (
        <div className="mt-0.5 flex items-end justify-between gap-3">
          <span className="text-sm text-chalk-dim">
            {movement.sets.length} × {first.reps} @ {first.percent}%
          </span>
          <span className="font-display text-4xl leading-none text-work">
            {fmtWeight(first.weightKg)}
            <span className="ml-1.5 text-base text-chalk-dim">{unit}</span>
          </span>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1">
          {movement.sets.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-edge/60 pb-1 last:border-0 last:pb-0"
            >
              <span className="text-sm text-chalk-dim">
                <span className="mr-2 inline-block w-4 text-right font-semibold text-chalk">
                  {i + 1}
                </span>
                {s.reps} @ {s.percent}%
              </span>
              <span className="font-display text-xl text-work">
                {fmtWeight(s.weightKg) ?? '—'}
                <span className="ml-1 text-xs text-chalk-dim">{unit}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
