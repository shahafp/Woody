import { toDisplayUnit, type Unit } from './convert'

/**
 * Round a stored-kg weight to the nearest loadable value in the display
 * unit — what you can actually put on a bar with the plates you have.
 * Rounding happens in display-unit space so lbs users get clean lbs numbers.
 */
export function roundToPlate(
  weightKg: number,
  unit: Unit,
  incrementKg: number,
  incrementLbs: number,
): number {
  const display = toDisplayUnit(weightKg, unit)
  const increment = unit === 'kg' ? incrementKg : incrementLbs
  if (increment <= 0) return display
  const rounded = Math.round(display / increment) * increment
  // avoid float dust like 92.50000000000001
  return Math.round(rounded * 1000) / 1000
}

export function formatWeight(value: number): string {
  return Number.isInteger(value)
    ? `${value}`
    : `${Math.round(value * 100) / 100}`
}
