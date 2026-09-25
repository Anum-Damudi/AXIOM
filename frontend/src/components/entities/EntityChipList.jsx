import { useMemo, useState } from 'react'
import Modal from '../Modal'
import Icon from '../Icon'
import EntityChip from './EntityChip'
import EmptyState from '../ui/EmptyState'
import { entityGroupKey, entityTypeKey } from './entityMeta'

export default function EntityChipList({
  entities = [],
  maxVisible = 6,
  onSelect,
  showStatus = true,
  title = 'All Related Entities',
  emptyText = 'No related entities.',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const visible = entities.slice(0, maxVisible)
  const hiddenCount = entities.length - visible.length

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = entities.filter((e) => {
      const name = String(e.name || e.id || '').toLowerCase()
      const type = entityTypeKey(e.type).toLowerCase()
      return !q || name.includes(q) || type.includes(q)
    })
    const groups = new Map()
    rows.forEach((e) => {
      const key = entityGroupKey(e.type)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(e)
    })
    return Array.from(groups.entries())
  }, [entities, query])

  return (
    <>
      {entities.length === 0 ? (
        <EmptyState icon="users" title="No related entities" message={emptyText} className="py-6" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((e) => (
            <EntityChip key={e.id} entity={e} onClick={onSelect ? () => onSelect(e) : undefined} showStatus={showStatus} />
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              className="entity-chip-list__more inline-flex items-center rounded-md border border-[var(--border-accent)] bg-[var(--accent-glow)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--accent)] transition-colors duration-150 hover:bg-[var(--accent-glow-strong)]"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <Icon name="plus" className="icon-xs" />
              {hiddenCount} more
            </button>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={title} size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2">
            <Icon name="search" className="icon-sm text-[var(--text-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entities..."
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              aria-label="Search entities"
            />
            <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{entities.length} total</span>
          </div>

          <div className="max-h-[50vh] space-y-5 overflow-y-auto pr-1">
            {grouped.length === 0 && (
              <EmptyState icon="search" title="No matches" message={`Nothing matches “${query}”.`} />
            )}
            {grouped.map(([group, items]) => (
              <section key={group}>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {group}
                </h4>
        <div className="entity-chip-list flex flex-wrap gap-2">
                  {items.map((e) => (
                    <EntityChip
                      key={e.id}
                      entity={e}
                      onClick={onSelect ? () => onSelect(e) : undefined}
                      showStatus={showStatus}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}