import { describe, expect, it } from 'vitest'
import { decideMerge, type Versioned } from './merge'

const row = (updatedAt: string, deletedAt: string | null = null): Versioned => ({
  id: 'x',
  updatedAt,
  deletedAt,
})

describe('decideMerge', () => {
  it('remote wins when no local row exists', () => {
    expect(decideMerge(undefined, row('2026-01-01T00:00:00Z'))).toBe('remote')
  })

  it('newer remote wins', () => {
    expect(
      decideMerge(row('2026-01-01T00:00:00Z'), row('2026-01-02T00:00:00Z')),
    ).toBe('remote')
  })

  it('newer local wins', () => {
    expect(
      decideMerge(row('2026-01-03T00:00:00Z'), row('2026-01-02T00:00:00Z')),
    ).toBe('local')
  })

  it('compares across Z and +00:00 timestamp formats', () => {
    // same instant, different serializations -> tie, local kept
    expect(
      decideMerge(
        row('2026-01-02T00:00:00.123Z'),
        row('2026-01-02T00:00:00.123+00:00'),
      ),
    ).toBe('local')
    expect(
      decideMerge(
        row('2026-01-02T00:00:00.123Z'),
        row('2026-01-02T00:00:00.124+00:00'),
      ),
    ).toBe('remote')
  })

  it('tombstone wins an exact tie in both directions', () => {
    const t = '2026-01-02T00:00:00Z'
    expect(decideMerge(row(t), row(t, t))).toBe('remote')
    expect(decideMerge(row(t, t), row(t))).toBe('local')
  })

  it('exact tie with no tombstones keeps local (idempotent re-merge)', () => {
    const t = '2026-01-02T00:00:00Z'
    expect(decideMerge(row(t), row(t))).toBe('local')
  })

  it('newer remote tombstone deletes a dirty local edit (LWW accepted)', () => {
    expect(
      decideMerge(
        row('2026-01-01T00:00:00Z'),
        row('2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'),
      ),
    ).toBe('remote')
  })
})
