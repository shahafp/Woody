import { Component, type ReactNode } from 'react'

interface State {
  hasError: boolean
}

/**
 * Last-resort catch: the timer session survives in IndexedDB, so a reload
 * resumes the workout instead of losing it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
        <h1 className="font-display text-3xl tracking-wide text-chalk">
          SOMETHING BROKE
        </h1>
        <p className="text-sm text-chalk-dim">
          Your data is safe on this device. Reload to pick up where you left off.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 h-14 rounded-2xl bg-work px-8 font-display text-xl tracking-wider text-surface"
        >
          RELOAD
        </button>
      </div>
    )
  }
}
