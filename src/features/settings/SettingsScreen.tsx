import { t } from '@/lib/i18n/t'
import type { Unit } from '@/lib/units/convert'
import { useSettingsStore } from './settingsStore'

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-base text-chalk">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition-colors ${
          checked ? 'bg-work' : 'bg-edge'
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-chalk transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export function SettingsScreen() {
  const s = useSettingsStore()
  const increments = s.unit === 'kg' ? [1, 1.25, 2.5, 5] : [2.5, 5, 10]
  const currentIncrement = s.unit === 'kg' ? s.plateIncrementKg : s.plateIncrementLbs

  return (
    <div className="flex min-h-full flex-col">
      <h1 className="font-display text-3xl tracking-wide text-chalk">
        {t('settings.title')}
      </h1>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
          {t('settings.units')}
        </h2>
        <div className="mt-3 flex gap-2">
          {(['kg', 'lbs'] as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => s.update({ unit: u })}
              className={`flex-1 rounded-xl py-3 text-base font-semibold ${
                s.unit === u ? 'bg-chalk text-surface' : 'bg-raised text-chalk-dim'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <span className="text-sm text-chalk-dim">{t('settings.plateIncrement')}</span>
          <div className="mt-2 flex gap-2">
            {increments.map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() =>
                  s.update(
                    s.unit === 'kg'
                      ? { plateIncrementKg: inc }
                      : { plateIncrementLbs: inc },
                  )
                }
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  currentIncrement === inc
                    ? 'bg-work text-surface'
                    : 'bg-raised text-chalk-dim'
                }`}
              >
                {inc} {s.unit}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-chalk-dim">
            {t('settings.plateIncrementHint')}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
          {t('settings.timer')}
        </h2>
        <div className="mt-3 divide-y divide-edge overflow-hidden rounded-xl bg-raised">
          <Toggle
            label={t('settings.sound')}
            checked={s.soundEnabled}
            onChange={(v) => s.update({ soundEnabled: v })}
          />
          <Toggle
            label={t('settings.vibrate')}
            checked={s.vibrateEnabled}
            onChange={(v) => s.update({ vibrateEnabled: v })}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
          {t('settings.account')}
        </h2>
        <p className="mt-3 text-sm text-chalk-dim">{t('settings.accountHint')}</p>
      </section>
    </div>
  )
}
