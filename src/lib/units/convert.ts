export type Unit = 'kg' | 'lbs'

const KG_PER_LB = 0.45359237

export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB
}

export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB
}

/** Canonical storage is kg; this converts for display. */
export function toDisplayUnit(weightKg: number, unit: Unit): number {
  return unit === 'kg' ? weightKg : kgToLbs(weightKg)
}

/** Parse a user-entered weight in the display unit back to kg. */
export function fromDisplayUnit(value: number, unit: Unit): number {
  return unit === 'kg' ? value : lbsToKg(value)
}
