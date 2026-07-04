import { Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { LiftRow } from '@/lib/db/types'
import type { WodSheetBlock, WodSheetMovement, WodSheetSet } from '@/lib/db/types'
import { t } from '@/lib/i18n/t'
import { newId } from '@/lib/ids'
import { CompactStepper } from '@/features/timer/components/CompactStepper'
import {
  blockMovements,
  generateWave,
  setsAreUniform,
  toBlockFields,
  uniformSets,
  type WaveSpec,
} from './blockModel'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const clampPct = (v: number) => clamp(v, 5, 120)
const clampReps = (v: number) => clamp(v, 1, 50)

const field =
  'w-full rounded-xl bg-edge px-3 py-2.5 text-base text-chalk outline-none placeholder:text-chalk-dim'
const labelCls = 'text-xs font-semibold uppercase tracking-[0.15em] text-chalk-dim'

function newMovement(liftId: string): WodSheetMovement {
  return { id: newId(), liftId, sets: uniformSets(5, 3, 75) }
}

/** Full editor for one WOD block: straight/wave sets, supersets, complexes, tempo, note. */
export function BlockEditor({
  lifts,
  initial,
  onSave,
  onCancel,
}: {
  lifts: LiftRow[]
  initial: WodSheetBlock | null
  onSave: (fields: Omit<WodSheetBlock, 'id'>) => void
  onCancel: () => void
}) {
  const firstLift = lifts[0]?.id ?? ''
  const [movements, setMovements] = useState<WodSheetMovement[]>(() =>
    initial
      ? blockMovements(initial).map((m) => ({ ...m, sets: m.sets.map((s) => ({ ...s })) }))
      : [newMovement(firstLift)],
  )
  const [label, setLabel] = useState(initial?.label ?? '')
  const [tempo, setTempo] = useState(initial?.tempo ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  const patch = (i: number, m: WodSheetMovement) =>
    setMovements((list) => list.map((x, j) => (j === i ? m : x)))
  const addMovement = () =>
    setMovements((list) => [...list, newMovement(firstLift)])
  const removeMovement = (i: number) =>
    setMovements((list) => list.filter((_, j) => j !== i))

  const save = () => {
    const cleaned = movements
      .map((m) => ({ ...m, label: m.label?.trim() || undefined }))
      .filter((m) => m.liftId && m.sets.length > 0)
    if (cleaned.length === 0) return
    onSave(toBlockFields({ label, tempo, note, movements: cleaned }))
  }

  const isSuperset = movements.length > 1

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-raised p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg tracking-wide text-chalk">
          {initial ? t('wod.editBlock') : t('wod.newBlock')}
        </span>
        {isSuperset && (
          <span className="rounded-full bg-work/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-work">
            {t('wod.superset')}
          </span>
        )}
      </div>

      {movements.map((movement, i) => (
        <MovementEditor
          key={movement.id}
          index={i}
          isSuperset={isSuperset}
          groupLabel={label}
          lifts={lifts}
          movement={movement}
          canRemove={movements.length > 1}
          onChange={(m) => patch(i, m)}
          onRemove={() => removeMovement(i)}
        />
      ))}

      <button
        type="button"
        onClick={addMovement}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-edge py-2.5 text-sm font-semibold text-chalk-dim active:bg-edge"
      >
        <Plus size={15} /> {t('wod.addMovement')}
      </button>

      {isSuperset && (
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t('wod.groupLabel')}</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('wod.groupLabelPlaceholder')}
            maxLength={2}
            className={field}
          />
        </label>
      )}

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={labelCls}>{t('wod.tempo')}</span>
          <input
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
            placeholder={t('wod.tempoPlaceholder')}
            className={field}
          />
        </label>
        <label className="flex flex-[2] flex-col gap-1.5">
          <span className={labelCls}>{t('wod.note')}</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('wod.notePlaceholder')}
            className={field}
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="flex-1 rounded-xl bg-work py-3 font-semibold text-surface"
        >
          {t('wod.save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl bg-edge px-5 font-semibold text-chalk-dim"
        >
          {t('wod.cancel')}
        </button>
      </div>
    </div>
  )
}

function MovementEditor({
  index,
  isSuperset,
  groupLabel,
  lifts,
  movement,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number
  isSuperset: boolean
  groupLabel: string
  lifts: LiftRow[]
  movement: WodSheetMovement
  canRemove: boolean
  onChange: (m: WodSheetMovement) => void
  onRemove: () => void
}) {
  const [mode, setMode] = useState<'straight' | 'wave'>(
    setsAreUniform(movement.sets) ? 'straight' : 'wave',
  )
  const first = movement.sets[0] ?? { reps: 3, percent: 75 }
  const [wave, setWave] = useState<WaveSpec>({
    basePercent: first.percent,
    step: 5,
    setsPerWave: 3,
    waves: 2,
    reps: first.reps,
  })

  const setSets = (sets: WodSheetSet[]) => onChange({ ...movement, sets })
  const patchSet = (i: number, s: WodSheetSet) =>
    setSets(movement.sets.map((x, j) => (j === i ? s : x)))

  const prefix = isSuperset ? `${groupLabel.trim() || ''}${index + 1}` : ''

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-edge/50 p-3">
      <div className="flex items-center gap-2">
        {prefix && (
          <span className="shrink-0 rounded-lg bg-work px-2 py-1 text-xs font-bold text-surface">
            {prefix}
          </span>
        )}
        <select
          value={movement.liftId}
          onChange={(e) => onChange({ ...movement, liftId: e.target.value })}
          className="min-w-0 flex-1 appearance-none rounded-lg bg-surface px-3 py-2 text-base text-chalk outline-none"
        >
          {lifts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {canRemove && (
          <button
            type="button"
            aria-label={t('wod.removeMovement')}
            onClick={onRemove}
            className="shrink-0 text-chalk-dim active:text-alarm"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <input
        value={movement.label ?? ''}
        onChange={(e) => onChange({ ...movement, label: e.target.value || undefined })}
        placeholder={t('wod.namePlaceholder')}
        className="w-full rounded-lg bg-surface px-3 py-2 text-sm text-chalk outline-none placeholder:text-chalk-dim"
      />

      <div className="flex gap-2">
        {(['straight', 'wave'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (m === mode) return
              if (m === 'straight') {
                setSets(uniformSets(movement.sets.length || 5, first.reps, first.percent))
              } else {
                // start a wave minimal — one set to build up from (+ Add set / Fill wave)
                setSets([{ reps: first.reps, percent: first.percent }])
              }
              setMode(m)
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
              mode === m ? 'bg-chalk text-surface' : 'bg-surface text-chalk-dim'
            }`}
          >
            {m === 'straight' ? t('wod.straight') : t('wod.wave')}
          </button>
        ))}
      </div>

      {mode === 'straight' ? (
        <div className="flex flex-col gap-3">
          <CompactStepper
            label={t('wod.sets')}
            display={`${movement.sets.length}`}
            onDecrement={() =>
              setSets(uniformSets(clamp(movement.sets.length - 1, 1, 12), first.reps, first.percent))
            }
            onIncrement={() =>
              setSets(uniformSets(clamp(movement.sets.length + 1, 1, 12), first.reps, first.percent))
            }
          />
          <CompactStepper
            label={t('wod.reps')}
            display={`${first.reps}`}
            onDecrement={() =>
              setSets(uniformSets(movement.sets.length, clampReps(first.reps - 1), first.percent))
            }
            onIncrement={() =>
              setSets(uniformSets(movement.sets.length, clampReps(first.reps + 1), first.percent))
            }
          />
          <CompactStepper
            label={t('wod.percent')}
            display={`${first.percent}%`}
            onDecrement={() =>
              setSets(uniformSets(movement.sets.length, first.reps, clampPct(first.percent - 5)))
            }
            onIncrement={() =>
              setSets(uniformSets(movement.sets.length, first.reps, clampPct(first.percent + 5)))
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-surface p-3">
            <div className="grid grid-cols-2 gap-2">
              <MiniField label={t('wod.base')} value={`${wave.basePercent}%`}
                onDec={() => setWave({ ...wave, basePercent: clampPct(wave.basePercent - 5) })}
                onInc={() => setWave({ ...wave, basePercent: clampPct(wave.basePercent + 5) })} />
              <MiniField label={t('wod.step')} value={`${wave.step > 0 ? '+' : ''}${wave.step}%`}
                onDec={() => setWave({ ...wave, step: clamp(wave.step - 5, 0, 25) })}
                onInc={() => setWave({ ...wave, step: clamp(wave.step + 5, 0, 25) })} />
              <MiniField label={t('wod.sets')} value={`${wave.setsPerWave}`}
                onDec={() => setWave({ ...wave, setsPerWave: clamp(wave.setsPerWave - 1, 1, 10) })}
                onInc={() => setWave({ ...wave, setsPerWave: clamp(wave.setsPerWave + 1, 1, 10) })} />
              <MiniField label={t('wod.waves')} value={`${wave.waves}`}
                onDec={() => setWave({ ...wave, waves: clamp(wave.waves - 1, 1, 6) })}
                onInc={() => setWave({ ...wave, waves: clamp(wave.waves + 1, 1, 6) })} />
            </div>
            <button
              type="button"
              onClick={() => setSets(generateWave(wave))}
              className="mt-3 w-full rounded-lg bg-rest py-2 text-sm font-semibold text-surface"
            >
              {t('wod.fillWave')}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {movement.sets.map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                <span className="w-6 shrink-0 text-xs font-semibold text-chalk-dim">{i + 1}</span>
                <MiniField label={t('wod.reps')} value={`${s.reps}`}
                  onDec={() => patchSet(i, { ...s, reps: clampReps(s.reps - 1) })}
                  onInc={() => patchSet(i, { ...s, reps: clampReps(s.reps + 1) })} />
                <MiniField label="%" value={`${s.percent}`}
                  onDec={() => patchSet(i, { ...s, percent: clampPct(s.percent - 5) })}
                  onInc={() => patchSet(i, { ...s, percent: clampPct(s.percent + 5) })} />
                <button
                  type="button"
                  aria-label="Remove set"
                  disabled={movement.sets.length === 1}
                  onClick={() => setSets(movement.sets.filter((_, j) => j !== i))}
                  className="ml-auto shrink-0 text-chalk-dim active:text-alarm disabled:opacity-30"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSets([...movement.sets, { ...(movement.sets.at(-1) ?? first) }])}
              className="rounded-lg border border-dashed border-edge py-2 text-sm font-semibold text-chalk-dim active:bg-surface"
            >
              + {t('wod.addSet')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniField({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string
  value: string
  onDec: () => void
  onInc: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-8 shrink-0 text-xs font-semibold uppercase tracking-wide text-chalk-dim">
        {label}
      </span>
      <button
        type="button"
        aria-label={`Less ${label}`}
        onClick={onDec}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-edge text-chalk active:bg-raised"
      >
        <Minus size={16} />
      </button>
      <span className="min-w-10 flex-1 text-center font-display text-lg text-chalk">{value}</span>
      <button
        type="button"
        aria-label={`More ${label}`}
        onClick={onInc}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-edge text-chalk active:bg-raised"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
