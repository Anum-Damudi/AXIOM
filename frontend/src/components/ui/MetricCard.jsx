import Icon from '../Icon'

function toneClass(tone) {
  switch (tone) {
    case 'high': return 'text-[var(--risk-high)] bg-[var(--risk-high-bg)] border-[color:var(--risk-high)]/30'
    case 'medium': return 'text-[var(--risk-medium)] bg-[var(--risk-medium-bg)] border-[color:var(--risk-medium)]/30'
    case 'low': return 'text-[var(--risk-low)] bg-[var(--risk-low-bg)] border-[color:var(--risk-low)]/30'
    default: return 'text-[var(--accent)] bg-[var(--accent-glow)] border-[color:var(--border-accent)]'
  }
}

export default function MetricCard({ label, value, icon, change, tone, onClick }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`metric-card group relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left transition-all duration-200 ${
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
            {value}
          </div>
          {change && (
            <div className="mt-2 truncate text-[13px] text-[var(--text-secondary)]">{change}</div>
          )}
        </div>
        {icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${toneClass(tone)}`}>
            <Icon name={icon} className="icon-sm" />
          </div>
        )}
      </div>
    </Comp>
  )
}