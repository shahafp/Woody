import { useState } from 'react'
import { useAuthStore } from './authStore'

interface AuthSignInOptionsProps {
  returnTo: string
}

const buttonClass = 'min-h-12 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-50'

/** Shared Google + passwordless-email sign-in used by Friends and Settings. */
export function AuthSignInOptions({ returnTo }: AuthSignInOptionsProps) {
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [linkSent, setLinkSent] = useState(false)

  const openGoogle = async () => {
    setBusy('google')
    setError(null)
    setLinkSent(false)
    try {
      setError(await signInWithGoogle(returnTo))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in could not be started.')
    } finally {
      setBusy(null)
    }
  }

  const emailLink = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy('email')
    setError(null)
    setLinkSent(false)
    try {
      const nextError = await signInWithEmail(email.trim(), returnTo)
      setError(nextError)
      setLinkSent(!nextError)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The sign-in email could not be sent.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <button
        type="button"
        className={`${buttonClass} bg-work text-surface`}
        disabled={busy !== null}
        onClick={() => void openGoogle()}
      >
        {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </button>

      <div className="flex items-center gap-3 text-xs text-chalk-dim" aria-hidden="true">
        <span className="h-px flex-1 bg-edge" />
        OR
        <span className="h-px flex-1 bg-edge" />
      </div>

      <form onSubmit={(event) => void emailLink(event)}>
        <label htmlFor="sign-in-email" className="text-sm font-medium">Email address</label>
        <input
          id="sign-in-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-xl border border-edge bg-surface px-3 py-3 text-chalk outline-none focus:border-work focus:ring-2 focus:ring-work/30"
        />
        <button
          className={`${buttonClass} mt-3 bg-edge text-chalk`}
          disabled={busy !== null || !email.trim()}
        >
          {busy === 'email' ? 'Sending link…' : 'Continue with email'}
        </button>
      </form>

      <p className="text-xs leading-5 text-chalk-dim">
        We’ll email you a secure sign-in link. If you’re new, it creates your account—no password needed.
      </p>
      {linkSent && (
        <p role="status" className="rounded-xl bg-work/10 px-3 py-2 text-sm text-work">
          Check your email and tap the link to finish signing in.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-alarm/15 px-3 py-2 text-sm text-alarm">{error}</p>}
    </div>
  )
}
