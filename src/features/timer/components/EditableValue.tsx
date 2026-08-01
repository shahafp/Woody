import { useRef, useState } from 'react'
import { maskClock } from '@/lib/format'

/**
 * A number that reads as plain text until you tap it, then turns into a
 * keyboard field. Nudging with −/+ is right when you're already close; typing
 * is right when the coach just said "ninety seconds". Both, always.
 *
 * With `mask="clock"` the field takes time the way a stopwatch does: digits
 * fill from the right and the colon writes itself, so "130" becomes 1:30
 * without ever reaching for a punctuation key.
 *
 * Commits on Enter or blur, discards on Escape. The parent owns parsing and
 * clamping — anything it can't read is simply ignored, leaving the value put.
 */
export function EditableValue({
  value,
  editValue,
  onCommit,
  ariaLabel,
  className = '',
  inputMode = 'numeric',
  mask,
  onEditingChange,
}: {
  value: string
  /** What the field opens with, when the display isn't literally editable. */
  editValue?: string
  onCommit: (text: string) => void
  ariaLabel: string
  className?: string
  inputMode?: 'numeric' | 'decimal'
  mask?: 'clock'
  /** Lets a parent drop unit suffixes and the like while the field is open. */
  onEditingChange?: (editing: boolean) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)
  const apply = (text: string) => (mask === 'clock' ? maskClock(text) : text)

  if (draft === null) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          cancelled.current = false
          setDraft(apply(editValue ?? value))
          onEditingChange?.(true)
        }}
        className={`${className} underline decoration-chalk-dim/40 decoration-dotted underline-offset-[6px]`}
      >
        {value}
      </button>
    )
  }

  const close = () => {
    setDraft(null)
    onEditingChange?.(false)
  }

  const commit = () => {
    const text = draft
    close()
    if (!cancelled.current) onCommit(text)
  }

  return (
    <input
      // the tap that opened the field already asked for the keyboard
      autoFocus
      aria-label={ariaLabel}
      value={draft}
      inputMode={inputMode}
      enterKeyHint="done"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const next = apply(e.target.value)
        setDraft(next)
        if (mask) {
          // the mask rewrites the whole string, so the caret belongs at the end
          const el = e.currentTarget
          requestAnimationFrame(() => el.setSelectionRange(next.length, next.length))
        }
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          cancelled.current = true
          close()
        }
      }}
      className={`${className} rounded-lg bg-edge text-center outline-none ring-2 ring-work`}
    />
  )
}
