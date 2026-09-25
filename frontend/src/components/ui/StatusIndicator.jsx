function dotFor(level) {
  const key = String(level || '').toUpperCase()
  if (['HIGH', 'CRITICAL', 'VERIFIED', 'ACTIVE'].includes(key)) {
    return 'bg-[var(--risk-high)]'
  }
  if (['MEDIUM', 'WARNING', 'REVIEW', 'PENDING'].includes(key)) {
    return 'bg-[var(--risk-medium)]'
  }
  return 'bg-[var(--risk-low)]'
}

// Compact severity/status indicator. Never communicates status by color alone
// — the level text is always rendered next to the dot.
export default function StatusIndicator({ level, label, className = '' }) {
  const text = label || String(level || 'Unknown')
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${className}`} title={text}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotFor(level)}`} aria-hidden="true" />
      <span className="text-[var(--text-muted)]">{text}</span>
    </span>
  )
}