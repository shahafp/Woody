/**
 * Fixed-width digit cells: Anton has no tabular figures, so each character
 * gets a constant-width cell — the clock never jitters as digits change.
 * Font size scales down as the string grows ("1:02:33" still fits).
 */
export function TimeDigits({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  const vw = Math.min(30, 150 / text.length)
  return (
    <span
      className={`font-display leading-none ${className}`}
      style={{ fontSize: `clamp(4rem, ${vw}vw, 11rem)` }}
    >
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="inline-block text-center"
          style={{ width: ch === ':' ? '0.34em' : '0.58em' }}
        >
          {ch}
        </span>
      ))}
    </span>
  )
}
