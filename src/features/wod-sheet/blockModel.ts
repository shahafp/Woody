import type { WodSheetBlock, WodSheetMovement, WodSheetSet } from '@/lib/db/types'

/** `count` identical sets — the shape of a plain "5 × 3 @ 75%" block. */
export function uniformSets(count: number, reps: number, percent: number): WodSheetSet[] {
  return Array.from({ length: count }, () => ({ reps, percent }))
}

export interface WaveSpec {
  basePercent: number
  /** Percent added per set within a wave, and per wave at the start. */
  step: number
  setsPerWave: number
  waves: number
  reps: number
}

/**
 * Wave loading: each wave climbs `step` per set, and each successive wave
 * starts one `step` higher — e.g. base 70 / step 5 / 3 sets / 2 waves →
 * 70,75,80, 75,80,85.
 */
export function generateWave({
  basePercent,
  step,
  setsPerWave,
  waves,
  reps,
}: WaveSpec): WodSheetSet[] {
  const sets: WodSheetSet[] = []
  for (let w = 0; w < waves; w++) {
    for (let s = 0; s < setsPerWave; s++) {
      sets.push({ reps, percent: basePercent + (w + s) * step })
    }
  }
  return sets
}

/** True when every set shares reps and percent — render it compactly. */
export function setsAreUniform(sets: WodSheetSet[]): boolean {
  if (sets.length === 0) return true
  const [first] = sets
  return sets.every((s) => s.reps === first.reps && s.percent === first.percent)
}

/**
 * The movements a block actually prescribes. New blocks store `movements`;
 * legacy blocks are normalized to a single movement so callers see one shape.
 */
export function blockMovements(block: WodSheetBlock): WodSheetMovement[] {
  if (block.movements && block.movements.length > 0) return block.movements
  return [
    {
      id: block.id,
      liftId: block.liftId,
      sets: uniformSets(block.sets, block.reps, block.percent),
    },
  ]
}

/**
 * Legacy mirror of a block's primary movement, so a client that predates
 * `movements` still shows a sensible `sets × reps @ percent`.
 */
export function mirrorLegacy(
  movements: WodSheetMovement[],
): Pick<WodSheetBlock, 'liftId' | 'sets' | 'reps' | 'percent'> {
  const primary = movements[0]
  const first = primary?.sets[0]
  return {
    liftId: primary?.liftId ?? '',
    sets: primary?.sets.length ?? 0,
    reps: first?.reps ?? 0,
    percent: first?.percent ?? 0,
  }
}

/** Finalize an editor draft into storable block fields (legacy mirror + optionals). */
export function toBlockFields(input: {
  label?: string
  tempo?: string
  note?: string
  movements: WodSheetMovement[]
}): Omit<WodSheetBlock, 'id'> {
  const trim = (v?: string) => (v?.trim() ? v.trim() : undefined)
  return {
    ...mirrorLegacy(input.movements),
    label: trim(input.label),
    tempo: trim(input.tempo),
    note: trim(input.note),
    movements: input.movements,
  }
}
