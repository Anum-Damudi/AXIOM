import Icon from '../Icon'

export default function EmptyState({ icon = 'search', title, message, action, children, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-10 text-center ${className}`.trim()}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--accent-glow)] text-[var(--accent)]">
          <Icon name={icon} className="icon-md" />
        </div>
      )}
      {title && <h3 className="m-0 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>}
      {message && <p className="m-0 max-w-sm text-sm text-[var(--text-muted)]">{message}</p>}
      {action && <div className="mt-1">{action}</div>}
      {children}
    </div>
  )
}