import { useMemo, useState } from 'react'
import Icon from '../Icon'
import StatusIndicator from '../ui/StatusIndicator'
import { entityGroupKey, entityTypeKey } from '../entities/entityMeta'

export default function CheckboxGroup({ items = [], selected = [], onToggle, title = 'Related Entities' }) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = items.filter((it) => {
      const name = String(it.name || it.id || '').toLowerCase()
      const type = entityTypeKey(it.type).toLowerCase()
      return !q || name.includes(q) || type.includes(q)
    })
    const map = new Map()
    rows.forEach((it) => {
      const key = entityGroupKey(it.type)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(it)
    })
    return Array.from(map.entries())
  }, [items, query])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-[var(--text-secondary)]">
          {title}
          <span className="ml-1.5 rounded-md border border-[var(--border-default)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
            {selected.length} selected
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2">
        <Icon name="search" className="icon-sm text-[var(--text-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities..."
          className="bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          aria-label={`Search ${title}`}
        />
      </div>

      <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
        {groups.length === 0 && (
          <p className="m-0 text-[12px] text-[var(--text-muted)]">No entities match “{query}”.</p>
        )}
        {groups.map(([group, list]) => (
          <div key={group}>
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {group}
            </h4>
            <div className="flex flex-col gap-1">
              {list.map((it) => {
                const checked = selected.includes(it.id)
                return (
                  <label
                    key={it.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-[var(--bg-card-hover)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(it.id)}
                      className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]" title={it.name}>
                      {it.name}
                    </span>
                    {it.risk && <StatusIndicator level={it.risk} label={it.risk} />}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}