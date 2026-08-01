import { useRef, useState } from 'react'

/**
 * A number that reads as plain text until you tap it, then turns into a
 * keyboard field. Nudging with −/+ is right when you're already close; typing
 * is right when the coach just said "ninety seconds". Both, always.
 *
 * Commits on Enter or blur, discards on Escape. The parent owns parsing and
 * clamping — anything it can't read is simply ignored, leaving the value put.
 */
export function EditableValue({
  value,
  onCommit,
  ariaLabel,
  className = '',
  inputMode = 'numeric',
}: {
  value: string
  onCommit: (text: string) => void
  ariaLabel: string
  className?: string
  inputMode?: 'numeric' | 'decimal'
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)

  if (draft === null) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          cancelled.current = false
          setDraft(value)
        }}
        className={`${className} underline decoration-chalk-dim/40 decoration-dotted underline-offset-[6px]`}
      >
        {value}
      </button>
    )
  }

  const commit = () => {
    const text = draft
    setDraft(null)
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
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          cancelled.current = true
          setDraft(null)
        }
      }}
      className={`${className} rounded-lg bg-edge text-center outline-none ring-2 ring-work`}
    />
  )
}
