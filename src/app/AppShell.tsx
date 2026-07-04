import type { ReactNode } from 'react'
import { TabBar } from './TabBar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-5 pb-28 pt-[calc(env(safe-area-inset-top)+16px)]">
        {children}
      </main>
      <TabBar />
    </div>
  )
}
