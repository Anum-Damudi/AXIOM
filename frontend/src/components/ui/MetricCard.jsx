import Icon from '../Icon'
import AnimatedNumber from '../motion/AnimatedNumber'

function toneClass(tone) {
  switch (tone) {
    case 'high': return 'metric-card__icon--high'
    case 'medium': return 'metric-card__icon--medium'
    case 'low': return 'metric-card__icon--low'
    default: return ''
  }
}

// Renders the existing metric value — AnimatedNumber only eases the number
// up to the value it was handed, it never invents or rounds one.
export default function MetricCard({ label, value, icon, change, tone, onClick, index }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={index === undefined ? undefined : { '--ax-i': index }}
      className={`metric-card group relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left ${
        onClick ? 'cursor-pointer hover:border-[color:var(--border-accent)] hover:bg-[var(--bg-card-hover)]' : ''
      }`}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--border-accent)] to-transparent opacity-60"
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {label}
          </div>
          <div className="mt-2 text-3xl font-bold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
            <AnimatedNumber value={value} />
          </div>
          {change && (
            <div className="mt-2 truncate text-[13px] text-[var(--text-secondary)]">{change}</div>
          )}
        </div>
        {icon && (
          <div className={`metric-card__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${toneClass(tone)}`}>
            <Icon name={icon} className="icon-sm" />
          </div>
        )}
      </div>
    </Comp>
  )
}
