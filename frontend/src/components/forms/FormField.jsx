import { Children, cloneElement, isValidElement } from 'react'

export default function FormField({ label, hint, error, required, full, children, className = '' }) {
  const styled = Children.map(children, (child) => {
    const isControl = isValidElement(child) && typeof child.type === 'string' && ['input', 'select', 'textarea'].includes(child.type.toLowerCase())
    if (!isControl) return child
    return cloneElement(child, {
      className: `${child.props.className || ''} axm-input ${full ? 'axm-input--full' : ''}`.trim(),
    })
  })

  return (
    <label className={`flex flex-col gap-1.5 ${full ? 'md:col-span-2' : ''} ${className}`}>
      <span className="text-[12px] font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </span>
      {styled}
      {hint && !error && <small className="text-[11px] text-[var(--text-muted)]">{hint}</small>}
      {error && <small role="alert" className="text-[11px] text-[var(--danger)]">{error}</small>}
    </label>
  )
}