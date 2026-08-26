import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import Drawer from '../components/Drawer'
import Icon from '../components/Icon'
import { NewCaseModal } from '../components/InvestigationModal'
import RiskBadge from '../components/RiskBadge'

export default function Cases() {
  const {
    cases,
    selectedCaseId,
    setSelectedCaseId,
    caseFilter,
    setCaseFilter,
    caseHighRiskOnly,
    setCaseHighRiskOnly,
    newCaseModalOpen,
    setNewCaseModalOpen,
    addCase,
  } = useApp()

  const [sortBy, setSortBy] = useState('lastUpdated')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    let list = [...cases]
    if (caseFilter) {
      const q = caseFilter.toLowerCase()
      list = list.filter((c) => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    }
    if (caseHighRiskOnly) {
      list = list.filter((c) => ['HIGH', 'CRITICAL'].includes(c.priority) || ['HIGH', 'CRITICAL'].includes(c.risk))
    }
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.status.toLowerCase() === statusFilter.toLowerCase())
    }
    list.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'priority') return b.priority.localeCompare(a.priority)
      return b.lastUpdated.localeCompare(a.lastUpdated)
    })
    return list
  }, [cases, caseFilter, caseHighRiskOnly, statusFilter, sortBy])

  const selectedCase = cases.find((c) => c.id === selectedCaseId)

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Cases</h2>
          <p className="page-header__desc">Manage active investigations and case intelligence.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setNewCaseModalOpen(true)}>
          <Icon name="plus" className="icon-xs" />
          New Case
        </button>
      </header>

      {caseHighRiskOnly && (
        <div className="filter-banner">
          Showing high-risk cases only
          <button type="button" className="filter-banner__clear" onClick={() => setCaseHighRiskOnly(false)}>
            Clear filter
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar__search">
          <Icon name="search" className="icon-sm" />
          <input
            type="text"
            placeholder="Search cases..."
            value={caseFilter}
            onChange={(e) => setCaseFilter(e.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="toolbar__select">
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Under Investigation">Under Investigation</option>
          <option value="Review">Review</option>
          <option value="Closed">Closed</option>
        </select>
        <button type="button" className="toolbar__btn" onClick={() => setSortBy(sortBy === 'lastUpdated' ? 'title' : 'lastUpdated')}>
          <Icon name="sort" className="icon-sm" />
          Sort
        </button>
      </div>

      <div className="case-grid">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            className="case-card"
            onClick={() => setSelectedCaseId(c.id)}
          >
            <div className="case-card__header">
              <span className="case-card__id">{c.id}</span>
              <RiskBadge level={c.priority} />
            </div>
            <h3 className="case-card__title">{c.title}</h3>
            <div className="case-card__meta">
              <span>{c.status}</span>
              <span>{c.entities} entities</span>
            </div>
            <div className="case-card__footer">
              <span>{c.leadInvestigator}</span>
              <span>{c.lastUpdated}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <p>No cases match your filters.</p>
          </div>
        )}
      </div>

      <Drawer
        open={!!selectedCase}
        onClose={() => setSelectedCaseId(null)}
        title={selectedCase ? selectedCase.title : 'Case Details'}
      >
        {selectedCase && (
          <div className="case-detail">
            <div className="case-detail__header">
              <span className="case-detail__id">{selectedCase.id}</span>
              <RiskBadge level={selectedCase.priority} />
              <span className="case-detail__status">{selectedCase.status}</span>
            </div>
            <p className="case-detail__desc">{selectedCase.description}</p>

            <section className="case-detail__section">
              <h4>Overview</h4>
              <dl className="detail-dl">
                <div><dt>Lead Investigator</dt><dd>{selectedCase.leadInvestigator}</dd></div>
                <div><dt>Entities</dt><dd>{selectedCase.entities}</dd></div>
                <div><dt>Last Updated</dt><dd>{selectedCase.lastUpdated}</dd></div>
              </dl>
            </section>

            <section className="case-detail__section">
              <h4>Persons ({selectedCase.persons.length})</h4>
              <ul className="detail-list">
                {selectedCase.persons.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </section>

            <section className="case-detail__section">
              <h4>Evidence ({selectedCase.evidence.length})</h4>
              <ul className="detail-list">
                {selectedCase.evidence.length ? selectedCase.evidence.map((e) => <li key={e}>{e}</li>) : <li>None linked</li>}
              </ul>
            </section>

            <section className="case-detail__section">
              <h4>Timeline</h4>
              <ul className="timeline">
                {selectedCase.timeline.map((t, i) => (
                  <li key={i} className="timeline__item">
                    <span className="timeline__date">{t.date}</span>
                    <span className="timeline__event">{t.event}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="case-detail__section">
              <h4>Risk Assessment</h4>
              <p className="case-detail__risk">
                Current risk level: <RiskBadge level={selectedCase.risk} />
              </p>
            </section>
          </div>
        )}
      </Drawer>

      <NewCaseModal open={newCaseModalOpen} onClose={() => setNewCaseModalOpen(false)} onCreate={addCase} />
    </div>
  )
}
