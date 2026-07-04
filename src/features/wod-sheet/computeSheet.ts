import type { WodSheetBlock } from '@/lib/db/types'
import { blockMovements, setsAreUniform } from './blockModel'

export interface SheetLiftInfo {
  name: string
  oneRmKg: number | null
}

export interface ComputedSet {
  reps: number
  percent: number
  /** Raw computed kg (display plate-rounds); null when no 1RM is stored. */
  weightKg: number | null
}

export interface ComputedMovement {
  liftId: string
  name: string
  sets: ComputedSet[]
  /** All sets share reps & percent — render as one line instead of per-set. */
  uniform: boolean
}

export interface ComputedBlock {
  block: WodSheetBlock
  label: string | null
  tempo: string | null
  note: string | null
  /** More than one movement — render as A1/A2/… done together. */
  isSuperset: boolean
  movements: ComputedMovement[]
}

export function computeSheet(
  blocks: WodSheetBlock[],
  lifts: Map<string, SheetLiftInfo>,
): ComputedBlock[] {
  return blocks.map((block) => {
    const movements = blockMovements(block).map((movement) => {
      const lift = lifts.get(movement.liftId)
      const oneRm = lift?.oneRmKg ?? null
      return {
        liftId: movement.liftId,
        name: movement.label || lift?.name || 'Unknown lift',
        uniform: setsAreUniform(movement.sets),
        sets: movement.sets.map((set) => ({
          reps: set.reps,
          percent: set.percent,
          weightKg: oneRm === null ? null : (oneRm * set.percent) / 100,
        })),
      }
    })
    return {
      block,
      label: block.label?.trim() ? block.label.trim() : null,
      tempo: block.tempo?.trim() ? block.tempo.trim() : null,
      note: block.note?.trim() ? block.note.trim() : null,
      isSuperset: movements.length > 1,
      movements,
    }
  })
}
