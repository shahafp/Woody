/**
 * Pure last-write-wins merge for single-user sync.
 * Whole-row granularity; client-stamped updatedAt; tombstone wins exact ties.
 *
 * Comparison is numeric (Date.parse): Postgres echoes timestamps as
 * `2026-07-04T08:00:00.123+00:00` while clients stamp `...123Z` — string
 * comparison across the two formats would silently mis-merge.
 */
export interface Versioned {
  id: string
  updatedAt: string
  deletedAt: string | null
}

export type MergeDecision = 'remote' | 'local'

export function decideMerge(
  local: Versioned | undefined,
  remote: Versioned,
): MergeDecision {
  if (!local) return 'remote'
  const remoteAt = Date.parse(remote.updatedAt)
  const localAt = Date.parse(local.updatedAt)
  if (remoteAt > localAt) return 'remote'
  if (remoteAt < localAt) return 'local'
  // exact timestamp tie: a delete anywhere beats an edit
  if (remote.deletedAt && !local.deletedAt) return 'remote'
  return 'local'
}
