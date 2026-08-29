import { Component, type ReactNode } from 'react'
import { supabase } from '@/lib/sync/supabase'

interface State {
  hasError: boolean
  errorMessage: string | null
}

/**
 * Last-resort catch: the timer session survives in IndexedDB, so a reload
 * resumes the workout instead of losing it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, errorMessage: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unknown render error' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Woody render failed', error, info)
  }

  private goHome = () => {
    window.location.assign('/')
  }

  private signOutAndGoHome = async () => {
    try {
      await supabase?.auth.signOut({ scope: 'local' })
    } finally {
      window.location.assign('/')
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
        <h1 className="font-display text-3xl tracking-wide text-chalk">
          SOMETHING BROKE
        </h1>
        <p className="text-sm text-chalk-dim">
          Your data is safe on this device. Return home, or sign out if this happened after signing in.
        </p>
        <details className="max-w-xs text-left text-xs text-chalk-dim">
          <summary className="cursor-pointer text-center underline">Technical details</summary>
          <p className="mt-2 break-words rounded-lg bg-raised p-3">{this.state.errorMessage}</p>
        </details>
        <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={this.goHome}
            className="h-14 rounded-2xl bg-work px-8 font-display text-xl tracking-wider text-surface"
          >
            GO HOME
          </button>
          <button
            type="button"
            onClick={() => void this.signOutAndGoHome()}
            className="min-h-12 rounded-xl bg-raised px-5 font-semibold text-chalk"
          >
            Sign out and recover
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 text-sm font-semibold text-chalk-dim underline"
          >
            Try reloading
          </button>
        </div>
      </div>
    )
  }
}
