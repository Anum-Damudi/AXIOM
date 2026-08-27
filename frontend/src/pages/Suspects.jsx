import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import Drawer from '../components/Drawer'
import Icon from '../components/Icon'
import RiskBadge from '../components/RiskBadge'

export default function Suspects() {
  const {
    entities, relationships, evidence, locations, timeline,
    selectedCaseId, selectedSuspectId, setSelectedSuspectId, navigate,
  } = useApp()
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')

  const caseEntities = useMemo(
    () => selectedCaseId ? entities.filter(e => e.caseId === selectedCaseId) : [],
    [entities, selectedCaseId]
  )

  const suspects = useMemo(
    () => caseEntities.filter(e => e.type === 'Person' && e.role === 'Suspect'),
    [caseEntities]
  )

  const caseRelationships = useMemo(
    () => selectedCaseId ? relationships.filter(r => r.caseId === selectedCaseId) : [],
    [relationships, selectedCaseId]
  )

  const caseEvidence = useMemo(
    () => selectedCaseId ? evidence.filter(e => e.caseId === selectedCaseId) : [],
    [evidence, selectedCaseId]
  )

  const caseLocations = useMemo(
    () => selectedCaseId ? locations.filter(l => l.caseId === selectedCaseId) : [],
    [locations, selectedCaseId]
  )

  const caseTimeline = useMemo(
    () => selectedCaseId ? timeline.filter(t => t.caseId === selectedCaseId) : [],
    [timeline, selectedCaseId]
  )

  const filtered = useMemo(() => {
    let list = [...suspects]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)
      )
    }
    if (riskFilter !== 'all') list = list.filter(s => (s.risk || '').toLowerCase() === riskFilter)
    return list
  }, [suspects, search, riskFilter])

  const selected = useMemo(
    () => selectedSuspectId ? caseEntities.find(e => e.id === selectedSuspectId) : null,
    [selectedSuspectId, caseEntities]
  )

  const getSuspectRels = (entityId) => caseRelationships.filter(r => r.fromId === entityId || r.toId === entityId)
  const getSuspectEvidence = (entityId) => caseEvidence.filter(e => e.relatedEntityId === entityId)
  const getSuspectLocations = (entityId) => caseLocations.filter(l => l.entityId === entityId)
  const getSuspectTimeline = (entityId) => caseTimeline.filter(t => t.entityId === entityId).sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  if (!selectedCaseId) {
    return (
      <div className="page-content">
        <header className="page-header">
          <div>
            <h2 className="page-header__title">Suspects</h2>
            <p className="page-header__desc">Person-of-interest registry with connection intelligence.</p>
          </div>
        </header>
        <div className="empty-state">
          <Icon name="users" className="icon-lg" />
          <p>Select a case to view suspects.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Suspects</h2>
          <p className="page-header__desc">Suspects for active case — {suspects.length} identified</p>
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
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Icon name="users" className="icon-lg" />
          <p>No suspects identified in this case yet.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('network')}>
            <Icon name="plus" className="icon-xs" /> Add Suspect
          </button>
        </div>
      ) : (
        <div className="suspect-cards">
          {filtered.map(s => {
            const rels = getSuspectRels(s.id)
            const evd = getSuspectEvidence(s.id)
            const locs = getSuspectLocations(s.id)
            const lastLoc = locs.length > 0 ? locs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))[0] : null
            const tl = getSuspectTimeline(s.id)
            const lastActivity = tl.length > 0 ? tl[0].date : s.createdAt?.slice(0, 10) || '—'

            return (
              <button
                key={s.id}
                type="button"
                className="suspect-card"
                onClick={() => setSelectedSuspectId(s.id)}
              >
                <div className="suspect-card__header">
                  <h3 className="suspect-card__name">{s.name}</h3>
                  <RiskBadge level={s.risk} />
                </div>
                <span className="suspect-card__type">Person — Suspect</span>
                {s.description && <p className="suspect-card__desc">{s.description}</p>}
                <div className="suspect-card__meta">
                  <span><Icon name="link" className="icon-xs" /> {rels.length} relationship{rels.length !== 1 ? 's' : ''}</span>
                  <span><Icon name="shield" className="icon-xs" /> {evd.length} evidence</span>
                  {lastLoc && <span><Icon name="location" className="icon-xs" /> {lastLoc.name}</span>}
                </div>
                <div className="suspect-card__footer">
                  <span className="suspect-card__activity">Last activity: {lastActivity}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelectedSuspectId(null)} title={selected ? selected.name : 'Suspect Details'}>
        {selected && (
          <div className="suspect-detail">
            <div className="suspect-detail__header">
              <span className="suspect-detail__id">{selected.id}</span>
              <RiskBadge level={selected.risk} />
              <span className="suspect-detail__role">Role: {selected.role || 'Person'}</span>
            </div>

            <p className="suspect-detail__summary">{selected.description}</p>

            <section className="case-detail__section">
              <h4>Overview</h4>
              <dl className="detail-dl">
                <div><dt>Type</dt><dd>{selected.type}</dd></div>
                <div><dt>Role</dt><dd>{selected.role || 'Unspecified'}</dd></div>
                <div><dt>Risk Level</dt><dd>{selected.risk}</dd></div>
                <div><dt>Case</dt><dd>{selected.caseId}</dd></div>
              </dl>
            </section>

            <section className="case-detail__section">
              <h4>Relationships</h4>
              {getSuspectRels(selected.id).length === 0 ? (
                <p className="empty-text">No relationships mapped yet.</p>
              ) : (
                <ul className="detail-list">
                  {getSuspectRels(selected.id).map(r => {
                    const otherId = r.fromId === selected.id ? r.toId : r.fromId
                    const other = caseEntities.find(e => e.id === otherId)
                    return <li key={r.id}>{other?.name || otherId} — {r.label || r.type}</li>
                  })}
                </ul>
              )}
            </section>

            <section className="case-detail__section">
              <h4>Evidence / Intelligence</h4>
              {getSuspectEvidence(selected.id).length === 0 ? (
                <p className="empty-text">No evidence linked yet.</p>
              ) : (
                <ul className="detail-list">
                  {getSuspectEvidence(selected.id).map(e => (
                    <li key={e.id}>{e.title} — <RiskBadge level={e.status === 'Verified' ? 'LOW' : 'MEDIUM'} /></li>
                  ))}
                </ul>
              )}
            </section>

            <section className="case-detail__section">
              <h4>Location Information</h4>
              {getSuspectLocations(selected.id).length === 0 ? (
                <p className="empty-text">No location data available.</p>
              ) : (
                <ul className="detail-list">
                  {getSuspectLocations(selected.id).slice(0, 3).map(l => (
                    <li key={l.id}>{l.name} — {l.locationType}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="case-detail__section">
              <h4>Timeline Activity</h4>
              {getSuspectTimeline(selected.id).length === 0 ? (
                <p className="empty-text">No timeline events.</p>
              ) : (
                <ul className="timeline">
                  {getSuspectTimeline(selected.id).slice(0, 5).map((t, i) => (
                    <li key={i} className="timeline__item">
                      <span className="timeline__date">{t.date}</span>
                      <span className="timeline__event">{t.event}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <button
              type="button"
              className="btn btn--primary btn--full"
              onClick={() => {
                setSelectedSuspectId(null)
                navigate('network', { suspectId: selected.id })
              }}
            >
              Investigate in Network
            </button>
          </div>
        )}
      </Drawer>
    </div>
  )
}
