import { ClipboardList, History } from 'lucide-react'
import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { LiftDetailScreen } from '@/features/lifts/LiftDetailScreen'
import { LiftsScreen } from '@/features/lifts/LiftsScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { TimerRunScreen } from '@/features/timer/TimerRunScreen'
import { TimerSetupScreen } from '@/features/timer/TimerSetupScreen'
import { useTimerStore } from '@/features/timer/timerStore'
import { AppShell } from './AppShell'
import { StubScreen } from './StubScreen'

function TimerRunOverlay() {
  const active = useTimerStore((s) => s.compiled !== null)
  if (!active) return null
  return <TimerRunScreen />
}

export default function App() {
  const restoreFromDb = useTimerStore((s) => s.restoreFromDb)
  const hydrateSettings = useSettingsStore((s) => s.hydrate)

  // Crash/reload recovery: an unfinished workout picks up exactly where the
  // wall clock says it should be.
  useEffect(() => {
    void restoreFromDb()
    void hydrateSettings()
  }, [restoreFromDb, hydrateSettings])

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<TimerSetupScreen />} />
          <Route
            path="/wod"
            element={
              <StubScreen
                icon={ClipboardList}
                title="TODAY’S WEIGHTS"
                body="Build your strength sets with percentages and see exact loads — no whiteboard needed. Coming in the next update."
              />
            }
          />
          <Route
            path="/log"
            element={
              <StubScreen
                icon={History}
                title="TRAINING LOG"
                body="Finished workouts will be saved here — times, rounds, loads and PRs."
              />
            }
          />
          <Route path="/lifts" element={<LiftsScreen />} />
          <Route path="/lifts/:id" element={<LiftDetailScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </AppShell>
      <TimerRunOverlay />
    </BrowserRouter>
  )
}
