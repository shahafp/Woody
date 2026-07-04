import type { WodSheetBlock } from '@/lib/db/types'

export interface SheetLiftInfo {
  name: string
  oneRmKg: number | null
}

export interface ComputedBlock {
  block: WodSheetBlock
  liftName: string
  /** Raw computed kg (display plate-rounds); null when no 1RM is stored. */
  weightKg: number | null
}

export function computeSheet(
  blocks: WodSheetBlock[],
  lifts: Map<string, SheetLiftInfo>,
): ComputedBlock[] {
  return blocks.map((block) => {
    const lift = lifts.get(block.liftId)
    const oneRm = lift?.oneRmKg ?? null
    return {
      block,
      liftName: lift?.name ?? 'Unknown lift',
      weightKg: oneRm === null ? null : (oneRm * block.percent) / 100,
    }
  })
}
