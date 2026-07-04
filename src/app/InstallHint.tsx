import { Share, X } from 'lucide-react'
import { useState } from 'react'
import { t } from '@/lib/i18n/t'

const DISMISS_KEY = 'wod-time:install-hint-dismissed'

function shouldShow(): boolean {
  if (typeof navigator === 'undefined') return false
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as { standalone?: boolean }).standalone === true)
  return isIos && !standalone && localStorage.getItem(DISMISS_KEY) === null
}

/** One-time iOS "Add to Home Screen" nudge — iOS has no install prompt API. */
export function InstallHint() {
  const [visible, setVisible] = useState(shouldShow)
  if (!visible) return null
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-edge bg-raised p-4">
      <Share size={18} className="mt-0.5 shrink-0 text-work" />
      <p className="flex-1 text-sm text-chalk-dim">{t('pwa.installHint')}</p>
      <button
        type="button"
        aria-label={t('pwa.dismiss')}
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1')
          setVisible(false)
        }}
        className="text-chalk-dim"
      >
        <X size={16} />
      </button>
    </div>
  )
}
