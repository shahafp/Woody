import type { LogResultType } from '@/lib/db/types'
import type { TimerConfig } from '@/features/timer/engine/types'

/** Prefill handed from a finished timer to the log form. */
export interface LogDraft {
  title: string
  timerConfig: TimerConfig | null
  resultType: LogResultType
  timeMs?: number
}

let draft: LogDraft | null = null

export function setLogDraft(d: LogDraft): void {
  draft = d
}

/** Read-and-clear: the form consumes the draft exactly once. */
export function takeLogDraft(): LogDraft | null {
  const d = draft
  draft = null
  return d
}
