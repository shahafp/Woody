import { t } from '@/lib/i18n/t'
import { useUpdateStore } from '@/lib/pwa/updateStore'
import { useTimerStore } from '@/features/timer/timerStore'

export function UpdateToast() {
  const needRefresh = useUpdateStore((s) => s.needRefresh)
  const apply = useUpdateStore((s) => s.apply)
  const timerActive = useTimerStore((s) => s.compiled !== null)

  // never interrupt a workout with an update prompt
  if (!needRefresh || !apply || timerActive) return null

  return (
    <div className="fixed inset-x-0 bottom-24 z-40 mx-auto flex w-fit items-center gap-3 rounded-full border border-edge bg-raised py-2 pl-5 pr-2 shadow-lg">
      <span className="text-sm font-semibold text-chalk">{t('pwa.updateReady')}</span>
      <button
        type="button"
        onClick={apply}
        className="rounded-full bg-work px-4 py-1.5 text-sm font-bold text-surface"
      >
        {t('pwa.restart')}
      </button>
    </div>
  )
}
