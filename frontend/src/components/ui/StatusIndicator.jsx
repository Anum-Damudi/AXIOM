// Severity buckets mirror the existing risk palette exactly — this component
// only changes how a dot and a label are drawn, not which tone a level maps to.
const LEVEL_TONE = {
  HIGH: 'critical',
  CRITICAL: 'critical',
  VERIFIED: 'critical',
  ACTIVE: 'critical',
  MEDIUM: 'warning',
  WARNING: 'warning',
  REVIEW: 'warning',
  PENDING: 'warning',
}

function toneFor(level) {
  return LEVEL_TONE[String(level || '').toUpperCase()] || 'low'
}

// Compact severity/status indicator. Never communicates status by color alone
// — the level text is always rendered next to the dot.
export default function StatusIndicator({ level, label, className = '' }) {
  const text = label || String(level || 'Unknown')
  const tone = toneFor(level)
  return (
    <span className={`ax-status ax-status--${tone} inline-flex items-center gap-1.5 text-[11px] font-medium ${className}`} title={text}>
      <span className="ax-dot" aria-hidden="true" />
      <span>{text}</span>
    </span>
  )
}
