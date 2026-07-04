import type { LucideIcon } from 'lucide-react'

export function StubScreen({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon
  title: string
  body: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-raised text-chalk-dim">
        <Icon size={30} />
      </div>
      <h1 className="font-display text-2xl tracking-wide text-chalk">{title}</h1>
      <p className="max-w-xs text-base text-chalk-dim">{body}</p>
    </div>
  )
}
