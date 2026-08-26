import { useMemo, useState } from 'react'
import { EVIDENCE_CATEGORIES } from '../data/mockData'
import { useApp } from '../context/AppContext'
import Drawer from '../components/Drawer'
import Icon from '../components/Icon'
import { LinkEvidenceModal } from '../components/InvestigationModal'

export default function Evidence() {
  const {
    evidence,
    cases,
    suspects,
    selectedEvidenceId,
    setSelectedEvidenceId,
    linkEvidenceModalOpen,
    setLinkEvidenceModalOpen,
    linkEvidenceId,
    setLinkEvidenceId,
    linkEvidence,
  } = useApp()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const filtered = useMemo(() => {
    let list = [...evidence]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (e) => e.description.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.type.toLowerCase().includes(q),
      )
    }
    if (categoryFilter !== 'All') list = list.filter((e) => e.category === categoryFilter)
    return list
  }, [evidence, search, categoryFilter])

  const selected = evidence.find((e) => e.id === selectedEvidenceId)

  const openLinkModal = (id) => {
    setLinkEvidenceId(id)
    setLinkEvidenceModalOpen(true)
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Evidence Vault</h2>
          <p className="page-header__desc">Secure evidence management with chain-of-custody tracking.</p>
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
      </div>

      <div className="data-table-wrap panel">
        <table className="data-table data-table--clickable">
          <thead>
            <tr>
              <th>Evidence ID</th>
              <th>Type</th>
              <th>Description</th>
              <th>Related Case</th>
              <th>Related Person</th>
              <th>Collected</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={e.id}
                onClick={() => setSelectedEvidenceId(e.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => ev.key === 'Enter' && setSelectedEvidenceId(e.id)}
              >
                <td>{e.id}</td>
                <td>{e.type}</td>
                <td className="data-table__desc">{e.description}</td>
                <td>{e.case}</td>
                <td>{e.person || '—'}</td>
                <td>{e.date}</td>
                <td>
                  <span className={`confidence confidence--${e.confidence >= 90 ? 'high' : e.confidence >= 75 ? 'med' : 'low'}`}>
                    {e.confidence}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><p>No evidence matches your filters.</p></div>}
      </div>

      <Drawer open={!!selected} onClose={() => setSelectedEvidenceId(null)} title={selected ? selected.id : 'Evidence Details'}>
        {selected && (
          <div className="evidence-detail">
            <div className="evidence-detail__type">{selected.type}</div>
            <h3 className="evidence-detail__desc">{selected.description}</h3>

            <dl className="detail-dl">
              <div><dt>Related Case</dt><dd>{selected.case}</dd></div>
              <div><dt>Related Person</dt><dd>{selected.person || 'Unlinked'}</dd></div>
              <div><dt>Collected Date</dt><dd>{selected.date}</dd></div>
              <div><dt>Confidence</dt><dd>{selected.confidence}%</dd></div>
              <div><dt>Status</dt><dd>{selected.status}</dd></div>
            </dl>

            <button type="button" className="btn btn--accent btn--full" onClick={() => openLinkModal(selected.id)}>
              Link Evidence
            </button>
          </div>
        )}
      </Drawer>

      <LinkEvidenceModal
        open={linkEvidenceModalOpen}
        onClose={() => { setLinkEvidenceModalOpen(false); setLinkEvidenceId(null) }}
        onLink={linkEvidence}
        cases={cases}
        suspects={suspects}
        evidenceId={linkEvidenceId}
      />
    </div>
  )
}
