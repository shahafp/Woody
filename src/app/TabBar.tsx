import { ClipboardList, Dumbbell, History, Settings, Timer } from 'lucide-react'
import { NavLink } from 'react-router'

const TABS = [
  { to: '/', label: 'Timer', icon: Timer },
  { to: '/wod', label: 'WOD', icon: ClipboardList },
  { to: '/log', label: 'Log', icon: History },
  { to: '/lifts', label: 'Lifts', icon: Dumbbell },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-edge bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${
                isActive ? 'text-work' : 'text-chalk-dim'
              }`
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
