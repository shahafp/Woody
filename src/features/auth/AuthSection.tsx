import { useState } from 'react'
import { t } from '@/lib/i18n/t'
import { syncNow, useSyncStore } from '@/lib/sync/engine'
import { useAuthStore } from './authStore'

/** Account + sync block embedded in the Settings screen. */
export function AuthSection() {
  const status = useAuthStore((s) => s.status)
  const email = useAuthStore((s) => s.email)
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail)
  const signOut = useAuthStore((s) => s.signOut)
  const { syncing, lastSyncAt, error } = useSyncStore()

  const [emailInput, setEmailInput] = useState('')
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  if (status === 'unconfigured') {
    return <p className="mt-3 text-sm text-chalk-dim">{t('settings.accountHint')}</p>
  }

  if (status === 'loading') return null

  if (status === 'signedOut') {
    return (
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-chalk-dim">{t('auth.pitch')}</p>
        {sent ? (
          <p className="rounded-xl bg-raised p-4 text-sm text-work">
            {t('auth.linkSent')}
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              className="min-w-0 flex-1 rounded-xl bg-raised px-4 py-3 text-base text-chalk outline-none placeholder:text-chalk-dim"
            />
            <button
              type="button"
              onClick={() => {
                void signInWithEmail(emailInput.trim()).then((err) => {
                  setSendError(err)
                  if (!err) setSent(true)
                })
              }}
              className="rounded-xl bg-work px-4 text-sm font-semibold text-surface"
            >
              {t('auth.sendLink')}
            </button>
          </div>
        )}
        {sendError && <p className="text-sm text-alarm">{sendError}</p>}
      </div>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="rounded-xl bg-raised p-4">
        <div className="text-sm text-chalk-dim">{t('auth.signedInAs')}</div>
        <div className="text-base font-semibold text-chalk">{email}</div>
        <div className="mt-2 text-xs text-chalk-dim">
          {t('auth.lastSync')}:{' '}
          {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : t('auth.never')}
        </div>
        {error && (
          <div className="mt-1 text-xs text-alarm">
            {t('auth.syncError')}: {error}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={syncing}
          onClick={() => void syncNow()}
          className="flex-1 rounded-xl bg-raised py-3 text-sm font-semibold text-chalk disabled:opacity-50"
        >
          {syncing ? t('auth.syncing') : t('auth.syncNow')}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex-1 rounded-xl bg-raised py-3 text-sm font-semibold text-chalk-dim"
        >
          {t('auth.signOut')}
        </button>
      </div>
    </div>
  )
}
