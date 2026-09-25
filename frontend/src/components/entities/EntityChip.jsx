import Icon from '../Icon'
import StatusIndicator from '../ui/StatusIndicator'
import { entityTypeMeta } from './entityMeta'

export default function EntityChip({ entity, onClick, showStatus = true, title }) {
  const meta = entityTypeMeta(entity.type)
  const label = title || entity.displayLabel || entity.name || entity.id || 'Unknown'
  const Comp = onClick ? 'button' : 'span'

  const base =
    'entity-chip inline-flex max-w-[240px] items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-card-hover)] px-2.5 py-1.5 text-[12px] leading-none transition-colors duration-150'

  const content = (
    <>
      {meta && (
        <span className="shrink-0 text-[var(--text-muted)]" aria-hidden="true">
          <Icon name={meta.icon} className="icon-xs" />
        </span>
      )}
      <span className="truncate font-medium text-[var(--text-primary)]" title={label}>
        {label}
      </span>
      {showStatus && entity?.risk && <StatusIndicator level={entity.risk} label={entity.risk} />}
    </>
  )

  if (Comp === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} text-left hover:border-[color:var(--border-accent)] hover:bg-[var(--bg-elevated)]`}
        title={label}
      >
        {content}
      </button>
    )
  }

  return <span className={base}>{content}</span>
}