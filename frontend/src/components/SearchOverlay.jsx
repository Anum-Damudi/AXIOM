import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import Icon from './Icon'

export default function SearchOverlay() {
  const { searchOpen, setSearchOpen, navigate, cases, evidence, entities } = useApp()
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const wasOpenRef = useRef(searchOpen)

  const suspects = useMemo(
    () => entities.filter(e => e.type === 'Person' && e.role === 'Suspect'),
    [entities]
  )

  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus()
    if (wasOpenRef.current && !searchOpen) setQuery('')
    wasOpenRef.current = searchOpen
  }, [searchOpen])

  const results = useMemo(() => {
    if (!query.trim()) return null
    const q = query.toLowerCase()
    return {
      cases: cases.filter(c => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)),
      entities: entities.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || (e.type || '').toLowerCase().includes(q)),
      suspects: suspects.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)),
      evidence: evidence.filter(e => (e.title || '').toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q) || e.id.toLowerCase().includes(q)),
    }
  }, [query, cases, entities, suspects, evidence])

  if (!searchOpen) return null

  const handleSelect = (type, item) => {
    setQuery(''); setSearchOpen(false)
    if (type === 'case') navigate('cases', { caseId: item.id })
    else if (type === 'entity') navigate('network', { networkNode: item.id })
    else if (type === 'suspect') navigate('suspects', { suspectId: item.id })
    else if (type === 'evidence') navigate('evidence', { evidenceId: item.id })
  }

  const hasResults = results && Object.values(results).some(arr => arr.length > 0)
  const totalResults = results ? Object.values(results).reduce((sum, arr) => sum + arr.length, 0) : 0

  return (
    <div className="search-overlay" onClick={() => setSearchOpen(false)} role="presentation">
      <div className="search-panel" onClick={e => e.stopPropagation()}>
        <div className="search-panel__input-wrap">
          <Icon name="search" className="icon-sm" />
          <input ref={inputRef} type="text" className="search-panel__input"
            placeholder="Search cases, entities, suspects, evidence..." value={query} onChange={e => setQuery(e.target.value)} />
          {query && <span className="search-panel__count">{totalResults} result{totalResults !== 1 ? 's' : ''}</span>}
          <kbd className="search-panel__kbd">ESC</kbd>
        </div>
        {results && (
          <div className="search-panel__results">
            {!hasResults && <p className="search-panel__empty">No results found for &ldquo;{query}&rdquo;</p>}
            {results.cases.length > 0 && (
              <div className="search-group">
                <span className="search-group__label"><Icon name="folder" className="icon-xs" /> Cases ({results.cases.length})</span>
                {results.cases.map(c => (
                  <button key={c.id} type="button" className="search-result" onClick={() => handleSelect('case', c)}>
                    <span className="search-result__id">{c.id}</span>
                    <span className="search-result__name">{c.title}</span>
                    <span className="search-result__meta">{c.status}</span>
                  </button>
                ))}
              </div>
            )}
            {results.entities.length > 0 && (
              <div className="search-group">
                <span className="search-group__label"><Icon name="network" className="icon-xs" /> Entities ({results.entities.length})</span>
                {results.entities.map(e => (
                  <button key={e.id} type="button" className="search-result" onClick={() => handleSelect('entity', e)}>
                    <span className="search-result__id">{e.id}</span>
                    <span className="search-result__name">{e.name}</span>
                    <span className="search-result__meta">{e.type}</span>
                  </button>
                ))}
              </div>
            )}
            {results.suspects.length > 0 && (
              <div className="search-group">
                <span className="search-group__label"><Icon name="users" className="icon-xs" /> Suspects ({results.suspects.length})</span>
                {results.suspects.map(s => (
                  <button key={s.id} type="button" className="search-result" onClick={() => handleSelect('suspect', s)}>
                    <span className="search-result__id">{s.id}</span>
                    <span className="search-result__name">{s.name}</span>
                    <span className="search-result__meta">{s.role || 'Person'}</span>
                  </button>
                ))}
              </div>
            )}
            {results.evidence.length > 0 && (
              <div className="search-group">
                <span className="search-group__label"><Icon name="shield" className="icon-xs" /> Evidence ({results.evidence.length})</span>
                {results.evidence.map(e => (
                  <button key={e.id} type="button" className="search-result" onClick={() => handleSelect('evidence', e)}>
                    <span className="search-result__id">{e.id}</span>
                    <span className="search-result__name">{e.title || e.description}</span>
                    <span className="search-result__meta">{e.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!query && (
          <div className="search-panel__suggestions">
            <p className="search-panel__hint">Type to search across all data</p>
            <div className="search-panel__shortcuts">
              <span className="search-shortcut"><kbd>NX</kbd> Case IDs</span>
              <span className="search-shortcut"><kbd>ENT</kbd> Entities</span>
              <span className="search-shortcut"><kbd>SUS</kbd> Suspects</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
