import Icon from '../Icon'

const SEVERITY_TONE = {
  CRITICAL: 'critical',
  HIGH: 'critical',
  ALERT: 'warning',
  THREAT: 'critical',
  INTEL: 'info',
  INTELLIGENCE: 'info',
  SIGNAL: 'info',
  UPDATE: 'low',
}

function toneFor(kind) {
  return SEVERITY_TONE[String(kind || '').toUpperCase()] || 'info'
}

// Structured alert/intelligence card — metadata is laid out as a definition
// list so it scans as data instead of a paragraph wall. Severity is carried by
// a leading rail plus the kind label, never by the icon color alone.
export default function AlertCard({ kind = 'ALERT', title, icon = 'alert', time, rows = [], action }) {
  const tone = toneFor(kind)
  return (
    <article
      className={`alert-card alert-card--${tone} relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] transition-colors duration-150 hover:border-[color:var(--border-accent)]`}
    >
      <span className="alert-card__rail" aria-hidden="true" />
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 pl-5">
        <div className="flex items-center gap-2">
          <span className="alert-card__glyph">
            <Icon name={icon} className="icon-xs" />
          </span>
          <span className="alert-card__kind">{kind}</span>
        </div>
        {time && (
          <span className="alert-card__time shrink-0 text-[11px] text-[var(--text-muted)]">
            {time}
          </span>
        )}
      </header>

      <div className="px-4 py-3 pl-5">
        <h4 className="alert-card__title m-0 mb-3 text-sm font-semibold text-[var(--text-primary)]">
          {title}
        </h4>
        {rows.length > 0 && (
          <dl className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-3">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] pt-0.5">
                  {row.label}
                </dt>
                <dd className="m-0 min-w-0 text-[13px] text-[var(--text-secondary)]">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="alert-card__action mt-3 inline-flex items-center gap-1 text-[12px] font-medium transition-colors"
          >
            {action.label} <Icon name="arrowRight" className="icon-xs" />
          </button>
        )}
      </div>
    </article>
  )
}