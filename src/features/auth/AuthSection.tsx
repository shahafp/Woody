import { useEffect, useState } from 'react'
import { t } from '@/lib/i18n/t'
import { syncNow, useSyncStore } from '@/lib/sync/engine'
import { getFriendBootstrap, updateFriendEmailPreference } from '@/features/friends/friendsRepo'
import { useAuthStore } from './authStore'

/** Account + sync block embedded in the Settings screen. */
export function AuthSection() {
  const status = useAuthStore((s) => s.status)
  const email = useAuthStore((s) => s.email)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signOut = useAuthStore((s) => s.signOut)
  const { syncing, lastSyncAt, error } = useSyncStore()

  const [signingIn, setSigningIn] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [emailInvitesEnabled, setEmailInvitesEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (status !== 'signedIn') {
      setEmailInvitesEnabled(null)
      return
    }
    void getFriendBootstrap().then(({ profile }) => {
      setEmailInvitesEnabled(profile?.emailInvitesEnabled ?? null)
    }).catch(() => undefined)
  }, [status])

  if (status === 'unconfigured') {
    return <p className="mt-3 text-sm text-chalk-dim">{t('settings.accountHint')}</p>
  }

  if (status === 'loading') return null

  if (status === 'signedOut') {
    return (
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-chalk-dim">{t('auth.pitch')}</p>
        <button
          type="button"
          disabled={signingIn}
          onClick={() => {
            setSigningIn(true)
            void signInWithGoogle('/settings').then((err) => {
              setSendError(err)
              setSigningIn(false)
            })
          }}
          className="min-h-12 rounded-xl bg-work px-4 text-sm font-semibold text-surface disabled:opacity-50"
        >
          {signingIn ? 'Opening Google…' : 'Continue with Google'}
        </button>
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
        {emailInvitesEnabled !== null && (
          <div className="mt-4 flex items-center justify-between border-t border-edge pt-3">
            <div>
              <div className="text-sm font-semibold">Workout invitation emails</div>
              <div className="text-xs text-chalk-dim">In-app invitations always remain available.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Workout invitation emails"
              aria-checked={emailInvitesEnabled}
              className={`relative h-7 w-12 shrink-0 rounded-full ${emailInvitesEnabled ? 'bg-work' : 'bg-edge'}`}
              onClick={() => {
                const next = !emailInvitesEnabled
                setEmailInvitesEnabled(next)
                void updateFriendEmailPreference(next).catch((caught) => {
                  setEmailInvitesEnabled(!next)
                  setSendError(caught instanceof Error ? caught.message : 'Could not update email preference')
                })
              }}
            >
              <span className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-chalk transition-transform ${emailInvitesEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
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
