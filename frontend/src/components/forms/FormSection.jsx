export default function FormSection({ title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 ${className}`}>
      {title && (
        <header className="mb-4 border-b border-[var(--border-subtle)] pb-3">
          <h3 className="m-0 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          {subtitle && <p className="m-0 mt-1 text-[12px] text-[var(--text-muted)]">{subtitle}</p>}
        </header>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  )
}