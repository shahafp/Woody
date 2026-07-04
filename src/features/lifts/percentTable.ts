export interface PercentRow {
  percent: number
  weightKg: number
}

export const STANDARD_PERCENTS = [
  100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50,
] as const

export function percentOf(oneRmKg: number, percent: number): number {
  return (oneRmKg * percent) / 100
}

export function buildPercentTable(
  oneRmKg: number,
  percents: readonly number[] = STANDARD_PERCENTS,
): PercentRow[] {
  return percents.map((percent) => ({
    percent,
    weightKg: percentOf(oneRmKg, percent),
  }))
}
