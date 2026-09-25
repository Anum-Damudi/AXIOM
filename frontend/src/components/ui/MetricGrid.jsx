import MetricCard from './MetricCard'

export default function MetricGrid({ items = [], minWidth = '12rem', className = '', ariaLabel = 'Key metrics' }) {
  if (items.length === 0) return null

  return (
    <div
      className={`metric-grid ${className}`.trim()}
      style={{ '--metric-grid-min': minWidth }}
      role="list"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <div role="listitem" key={item.id || item.label}>
          <MetricCard {...item} />
        </div>
      ))}
    </div>
  )
}
