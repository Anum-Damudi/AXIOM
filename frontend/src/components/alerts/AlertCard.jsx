import Icon from '../Icon'

// Structured alert/intelligence card — metadata is laid out as a definition
// list so it scans as data instead of a paragraph wall.
export default function AlertCard({ kind = 'ALERT', title, icon = 'alert', time, rows = [], action }) {
  return (
    <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] transition-colors duration-150 hover:border-[color:var(--border-accent)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-glow)] text-[var(--accent)]">
            <Icon name={icon} className="icon-xs" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">{kind}</span>
        </div>
        {time && <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{time}</span>}
      </header>

      <div className="px-4 py-3">
        <h4 className="m-0 mb-3 text-sm font-semibold text-[var(--text-primary)]">{title}</h4>
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
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--text-primary)]"
          >
            {action.label} <Icon name="arrowRight" className="icon-xs" />
          </button>
        )}
      </div>
    </article>
  )
}