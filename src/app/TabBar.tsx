import { useEffect, useState } from 'react'
import { ClipboardList, Dumbbell, History, Settings, Timer, Users } from 'lucide-react'
import { NavLink } from 'react-router'
import { useAuthStore } from '@/features/auth/authStore'
import { listFriendInvitations, subscribeToFriendChanges } from '@/features/friends/friendsRepo'

const TABS = [
  { to: '/', label: 'Timer', icon: Timer },
  { to: '/wod', label: 'WOD', icon: ClipboardList },
  { to: '/log', label: 'Log', icon: History },
  { to: '/lifts', label: 'Lifts', icon: Dumbbell },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function TabBar() {
  const authStatus = useAuthStore((state) => state.status)
  const [pendingInvitations, setPendingInvitations] = useState(0)

  useEffect(() => {
    if (authStatus !== 'signedIn') {
      setPendingInvitations(0)
      return
    }
    const refresh = () => {
      void listFriendInvitations()
        .then((invitations) => setPendingInvitations(invitations.length))
        .catch(() => setPendingInvitations(0))
    }
    refresh()
    return subscribeToFriendChanges(refresh)
  }, [authStatus])

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
            aria-label={label === 'Friends' && pendingInvitations > 0 ? `Friends, ${pendingInvitations} pending invitations` : label}
          >
            <span className="relative"><Icon size={22} />{label === 'Friends' && pendingInvitations > 0 && <span className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-alarm" aria-hidden="true" />}</span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
