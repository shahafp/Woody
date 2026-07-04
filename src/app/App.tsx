import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { initSyncTriggers } from '@/lib/sync/engine'
import { useAuthStore } from '@/features/auth/authStore'
import { LiftDetailScreen } from '@/features/lifts/LiftDetailScreen'
import { LiftsScreen } from '@/features/lifts/LiftsScreen'
import { LogDetailScreen } from '@/features/log/LogDetailScreen'
import { LogEntryFormScreen } from '@/features/log/LogEntryFormScreen'
import { LogListScreen } from '@/features/log/LogListScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { TimerRunScreen } from '@/features/timer/TimerRunScreen'
import { TimerSetupScreen } from '@/features/timer/TimerSetupScreen'
import { useTimerStore } from '@/features/timer/timerStore'
import { WodSheetScreen } from '@/features/wod-sheet/WodSheetScreen'
import { AppShell } from './AppShell'
import { ErrorBoundary } from './ErrorBoundary'
import { UpdateToast } from './UpdateToast'

function TimerRunOverlay() {
  const active = useTimerStore((s) => s.compiled !== null)
  if (!active) return null
  return <TimerRunScreen />
}

export default function App() {
  const restoreFromDb = useTimerStore((s) => s.restoreFromDb)
  const hydrateSettings = useSettingsStore((s) => s.hydrate)
  const initAuth = useAuthStore((s) => s.init)

  // Crash/reload recovery: an unfinished workout picks up exactly where the
  // wall clock says it should be.
  useEffect(() => {
    void restoreFromDb()
    void hydrateSettings()
    initAuth()
    // ask the browser not to evict IndexedDB under storage pressure (iOS)
    void navigator.storage?.persist?.()
    return initSyncTriggers()
  }, [restoreFromDb, hydrateSettings, initAuth])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell>
        <Routes>
          <Route path="/" element={<TimerSetupScreen />} />
          <Route path="/wod" element={<WodSheetScreen />} />
          <Route path="/log" element={<LogListScreen />} />
          <Route path="/log/new" element={<LogEntryFormScreen />} />
          <Route path="/log/:id" element={<LogDetailScreen />} />
          <Route path="/lifts" element={<LiftsScreen />} />
          <Route path="/lifts/:id" element={<LiftDetailScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
        </AppShell>
        <TimerRunOverlay />
        <UpdateToast />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
