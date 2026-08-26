import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import Drawer from '../components/Drawer'
import Icon from '../components/Icon'
import RiskBadge from '../components/RiskBadge'

export default function Suspects() {
  const { suspects, selectedSuspectId, setSelectedSuspectId, navigate } = useApp()
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    let list = [...suspects]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.alias?.toLowerCase().includes(q),
      )
    }
    if (riskFilter !== 'all') list = list.filter((s) => s.risk.toLowerCase() === riskFilter)
    if (statusFilter !== 'all') list = list.filter((s) => s.status.toLowerCase().includes(statusFilter.toLowerCase()))
    return list
  }, [suspects, search, riskFilter, statusFilter])

  const selected = suspects.find((s) => s.id === selectedSuspectId)

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Suspects</h2>
          <p className="page-header__desc">Person-of-interest registry with connection intelligence.</p>
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar__search">
          <Icon name="search" className="icon-sm" />
          <input type="text" placeholder="Search suspects..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="toolbar__select">
          <option value="all">All Risk Levels</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="toolbar__select">
          <option value="all">All Status</option>
          <option value="active">Active Surveillance</option>
          <option value="investigation">Under Investigation</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="data-table-wrap panel">
        <table className="data-table data-table--clickable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Alias</th>
              <th>Risk</th>
              <th>Cases</th>
              <th>Connections</th>
              <th>Last Activity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} onClick={() => setSelectedSuspectId(s.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelectedSuspectId(s.id)}>
                <td>{s.id}</td>
                <td>{s.name}</td>
                <td>{s.alias || '—'}</td>
                <td><RiskBadge level={s.risk} /></td>
                <td>{s.cases.length}</td>
                <td>{s.connections}</td>
                <td>{s.lastActivity}</td>
                <td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><p>No suspects match your filters.</p></div>}
      </div>

      <Drawer open={!!selected} onClose={() => setSelectedSuspectId(null)} title={selected ? selected.name : 'Suspect Intelligence'}>
        {selected && (
          <div className="suspect-detail">
            <div className="suspect-detail__header">
              <span className="suspect-detail__id">{selected.id}</span>
              {selected.alias && <span className="suspect-detail__alias">&ldquo;{selected.alias}&rdquo;</span>}
              <RiskBadge level={selected.risk} />
            </div>

            <div className="risk-score">
              <span className="risk-score__label">Risk Score</span>
              <div className="risk-score__bar">
                <div className="risk-score__fill" style={{ width: `${selected.riskScore}%` }} />
              </div>
              <span className="risk-score__value">{selected.riskScore}/100</span>
            </div>

            <p className="suspect-detail__summary">{selected.summary}</p>

            <section className="case-detail__section">
              <h4>Associated Cases</h4>
              <ul className="detail-list">{selected.cases.map((c) => <li key={c}>{c}</li>)}</ul>
            </section>

            <section className="case-detail__section">
              <h4>Known Associates</h4>
              <ul className="detail-list">
                {selected.associates.length ? selected.associates.map((a) => <li key={a}>{a}</li>) : <li>None identified</li>}
              </ul>
            </section>

            <section className="case-detail__section">
              <h4>Evidence</h4>
              <ul className="detail-list">
                {selected.evidence.length ? selected.evidence.map((e) => <li key={e}>{e}</li>) : <li>None linked</li>}
              </ul>
            </section>

            <section className="case-detail__section">
              <h4>Locations</h4>
              <ul className="detail-list">{selected.locations.map((l) => <li key={l}>{l}</li>)}</ul>
            </section>

            <section className="case-detail__section">
              <h4>Timeline</h4>
              <ul className="timeline">
                {selected.timeline.map((t, i) => (
                  <li key={i} className="timeline__item">
                    <span className="timeline__date">{t.date}</span>
                    <span className="timeline__event">{t.event}</span>
                  </li>
                ))}
              </ul>
            </section>

            <button
              type="button"
              className="btn btn--primary btn--full"
              onClick={() => {
                setSelectedSuspectId(null)
                navigate('network', { suspectId: selected.id })
              }}
            >
              Investigate Network
            </button>
          </div>
        )}
      </Drawer>
    </div>
  )
}
