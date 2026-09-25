export default function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] ${className}`}
    >
      {children}
    </span>
  )
}