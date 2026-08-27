import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import Drawer from '../components/Drawer'
import Icon from '../components/Icon'

const EVIDENCE_TYPES = ['Document', 'Communication Record', 'Financial Record', 'Location Record', 'Digital Evidence', 'Observation', 'Photograph/Media', 'Other']
const EVIDENCE_STATUSES = ['Pending', 'Under Review', 'Verified', 'Archived']
const EVIDENCE_CATEGORIES = ['All', ...EVIDENCE_TYPES]

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function Evidence() {
  const {
    evidence, entities, cases, selectedCaseId, setSelectedCaseId,
    selectedEvidenceId, setSelectedEvidenceId, addEvidence,
  } = useApp()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'Document', description: '', date: todayISO(), source: '', relatedEntityId: '', status: 'Pending' })

  const selectedCase = useMemo(
    () => selectedCaseId ? cases.find(c => c.id === selectedCaseId) : null,
    [selectedCaseId, cases]
  )

  const caseEntities = useMemo(
    () => selectedCaseId ? entities.filter(e => e.caseId === selectedCaseId) : [],
    [entities, selectedCaseId]
  )

  const caseEvidence = useMemo(
    () => selectedCaseId ? evidence.filter(e => e.caseId === selectedCaseId) : [],
    [evidence, selectedCaseId]
  )

  const filtered = useMemo(() => {
    let list = [...caseEvidence]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.type || '').toLowerCase().includes(q)
      )
    }
    if (categoryFilter !== 'All') list = list.filter(e => e.type === categoryFilter)
    return list
  }, [caseEvidence, search, categoryFilter])

  const selected = useMemo(
    () => selectedEvidenceId ? caseEvidence.find(e => e.id === selectedEvidenceId) : null,
    [selectedEvidenceId, caseEvidence]
  )

  const getRelatedEntity = (entityId) => caseEntities.find(e => e.id === entityId)

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !selectedCaseId) return
    addEvidence({
      ...form,
      caseId: selectedCaseId,
      relatedEntityId: form.relatedEntityId || null,
    })
    setForm({ title: '', type: 'Document', description: '', date: todayISO(), source: '', relatedEntityId: '', status: 'Pending' })
    setShowAddForm(false)
  }

  if (!selectedCaseId) {
    return (
      <div className="page-content">
        <header className="page-header">
          <div>
            <h2 className="page-header__title">Evidence Vault</h2>
            <p className="page-header__desc">Secure evidence management with chain-of-custody tracking.</p>
          </div>
        </header>
        <div className="empty-state">
          <Icon name="shield" className="icon-lg" />
          <p>Select a case to view evidence.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Evidence Vault</h2>
          <p className="page-header__desc">Evidence for {selectedCase?.title || selectedCaseId} — {caseEvidence.length} items</p>
        </div>
        <div className="page-header__actions">
          <select className="toolbar__select" value={selectedCaseId || ''} onChange={e => setSelectedCaseId(e.target.value || null)}>
            <option value="">Select Case</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
          </select>
        </div>
      </header>

      <div className="category-tabs">
        {EVIDENCE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`category-tab ${categoryFilter === cat ? 'category-tab--active' : ''}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <Icon name="search" className="icon-sm" />
          <input type="text" placeholder="Search evidence..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Icon name="plus" className="icon-xs" /> Add Evidence
        </button>
      </div>

      {showAddForm && (
        <section className="panel">
          <header className="panel__header">
            <div><h3 className="panel__title">Add Evidence</h3><p className="panel__subtitle">Evidence will be assigned to case {selectedCaseId}</p></div>
          </header>
          <div className="panel__body">
            <form onSubmit={handleSubmit} className="intel-form">
              <div className="form-field">
                <label>Title *</label>
                <input type="text" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="e.g. Financial Transaction Record" required />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Evidence Type</label>
                  <select value={form.type} onChange={e => updateField('type', e.target.value)}>
                    {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Status</label>
                  <select value={form.status} onChange={e => updateField('status', e.target.value)}>
                    {EVIDENCE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="Describe the evidence item..." />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Source</label>
                  <input type="text" value={form.source} onChange={e => updateField('source', e.target.value)} placeholder="e.g. Field Investigation" />
                </div>
              </div>
              <div className="form-field">
                <label>Related Entity</label>
                <select value={form.relatedEntityId} onChange={e => updateField('relatedEntityId', e.target.value)}>
                  <option value="">None</option>
                  {caseEntities.map(ent => (
                    <option key={ent.id} value={ent.id}>{ent.name} ({ent.type})</option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={!form.title.trim()}>
                  <Icon name="plus" className="icon-sm" /> Add Evidence
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Icon name="shield" className="icon-lg" />
          <p>No evidence has been added to this case yet.</p>
          <button type="button" className="btn btn--primary" onClick={() => setShowAddForm(true)}>
            <Icon name="plus" className="icon-xs" /> Add Evidence
          </button>
        </div>
      ) : (
        <div className="data-table-wrap panel">
          <table className="data-table data-table--clickable">
            <thead>
              <tr>
                <th>Evidence ID</th>
                <th>Title</th>
                <th>Type</th>
                <th>Related Entity</th>
                <th>Date</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const entity = getRelatedEntity(e.relatedEntityId)
                return (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedEvidenceId(e.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(ev) => ev.key === 'Enter' && setSelectedEvidenceId(e.id)}
                  >
                    <td>{e.id}</td>
                    <td className="data-table__desc">{e.title || e.description}</td>
                    <td>{e.type}</td>
                    <td>{entity ? entity.name : '—'}</td>
                    <td>{e.date}</td>
                    <td>{e.source}</td>
                    <td>
                      <span className={`status-badge status-badge--${(e.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                        {e.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelectedEvidenceId(null)} title={selected ? selected.title || selected.id : 'Evidence Details'}>
        {selected && (
          <div className="evidence-detail">
            <div className="evidence-detail__type">{selected.type}</div>
            <h3 className="evidence-detail__desc">{selected.title || selected.description}</h3>
            {selected.description && selected.title && <p className="evidence-detail__full-desc">{selected.description}</p>}

            <dl className="detail-dl">
              <div><dt>Evidence Type</dt><dd>{selected.type}</dd></div>
              <div><dt>Related Case</dt><dd>{selected.caseId}</dd></div>
              <div><dt>Related Entity</dt><dd>{getRelatedEntity(selected.relatedEntityId)?.name || 'Unlinked'}</dd></div>
              <div><dt>Date</dt><dd>{selected.date}</dd></div>
              <div><dt>Source</dt><dd>{selected.source}</dd></div>
              <div><dt>Status</dt><dd>{selected.status}</dd></div>
            </dl>

            {selected.description && (
              <section className="case-detail__section">
                <h4>Description</h4>
                <p>{selected.description}</p>
              </section>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
