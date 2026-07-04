export type TimerMode = 'forTime' | 'amrap' | 'emom' | 'interval' | 'ratioInterval' | 'custom'

export interface CustomStep {
  kind: 'work' | 'rest'
  durationMs: number
  label?: string
}

export type TimerConfig =
  | { mode: 'forTime'; capMs: number }
  | { mode: 'amrap'; durationMs: number }
  | { mode: 'emom'; intervalMs: number; rounds: number }
  | { mode: 'interval'; workMs: number; restMs: number; rounds: number }
  /** Open-clock work ended by a lap tap; rest = work × ratio (ratio = rest ÷ work). */
  | { mode: 'ratioInterval'; ratio: number; rounds: number }
  | { mode: 'custom'; rounds: number; steps: CustomStep[] }

export type CueSound = 'tick' | 'go' | 'transition' | 'finish'

export interface Cue {
  /** Offset from t=0 of active (unpaused) time, prep included. */
  atMs: number
  sound: CueSound
  vibrate?: number[]
}

export interface Segment {
  index: number
  kind: 'prep' | 'work' | 'rest'
  label: string
  /** Offset from t=0 of active time. */
  startMs: number
  durationMs: number
  /** 1-based; 0 for prep. */
  round: number
  totalRounds: number
  /** Work segment whose end isn't known yet — awaiting a lap. */
  open?: boolean
}

export interface CompiledTimer {
  config: TimerConfig
  segments: Segment[]
  /** Sorted by atMs. */
  cues: Cue[]
  display: 'up' | 'down'
  /** Active duration including prep. */
  totalMs: number
}

export type TimerEvent =
  | { type: 'start'; at: number }
  | { type: 'pause'; at: number }
  | { type: 'resume'; at: number }
  /** DONE tap closing the current open work segment (ratioInterval). */
  | { type: 'lap'; at: number }
  | { type: 'finish'; at: number }

export type TimerPhase = 'idle' | 'prep' | 'running' | 'paused' | 'done'

export interface TimerView {
  phase: TimerPhase
  segment: Segment | null
  segmentElapsedMs: number
  segmentRemainingMs: number
  /** Active ms since t=0, prep included, clamped to totalMs. */
  elapsedActiveMs: number
  /** Active ms excluding prep — what For Time displays and logs. */
  workElapsedMs: number
  totalRemainingMs: number
  round: number
  totalRounds: number
  /** For Time result: set when finished manually or by cap; null while running. */
  finishedWorkMs: number | null
}
