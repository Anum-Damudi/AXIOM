import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import NetworkGraph from '../components/NetworkGraph'
import RiskBadge from '../components/RiskBadge'
import MetricGrid from '../components/ui/MetricGrid'
import AlertCard from '../components/alerts/AlertCard'
import EntityChipList from '../components/entities/EntityChipList'

const TYPE_COLORS = {
  PERSON: '#c2e8ff', ORGANIZATION: '#8598b8', PHONE: '#e3c07a', LOCATION: '#9cc4a8',
  BANK: '#e8a09a', VEHICLE: '#94a3b8', EVIDENCE: '#d9a06a', CASE: '#7298af',
  OTHER: '#94a3b8', CONTACT: '#e3c07a',
}

function CaseOverview() {
  const { navigate, cases, entities, relationships, evidence, aiSuggestions, timeline, locations,
    selectedCaseId, runAIAnalysis, analyzing, analysisStep } = useApp()

  const sel = useMemo(() => cases.find(c => c.id === selectedCaseId) || null, [cases, selectedCaseId])
  const ents = useMemo(() => entities.filter(e => e.caseId === selectedCaseId), [entities, selectedCaseId])
  const suspects = useMemo(() => ents.filter(e => e.type === 'Person' && e.role === 'Suspect'), [ents])
  const rels = useMemo(() => relationships.filter(r => r.caseId === selectedCaseId), [relationships, selectedCaseId])
  const confirmed = useMemo(() => rels.filter(r => ['CONFIRMED', 'AI_CONFIRMED', 'MANUAL'].includes(r.status)), [rels])
  const pending = useMemo(() => aiSuggestions.filter(s => s.caseId === selectedCaseId && s.status === 'PENDING'), [aiSuggestions, selectedCaseId])
  const caseEvidence = useMemo(() => evidence.filter(e => e.caseId === selectedCaseId), [evidence, selectedCaseId])
  const caseLocations = useMemo(() => locations.filter(l => l.caseId === selectedCaseId), [locations, selectedCaseId])
  const tl = useMemo(() => timeline.filter(t => t.caseId === selectedCaseId).slice(0, 5), [timeline, selectedCaseId])
  const dist = useMemo(() => {
    const m = {}
    ents.forEach(e => { const t = (e.type || 'OTHER').toUpperCase(); m[t] = (m[t] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [ents])
  const gNodes = useMemo(() => ents.map(e => ({ id: e.id, label: e.name, type: (e.type || 'OTHER').toUpperCase(), risk: e.risk || 'LOW', entityId: e.id })), [ents])
  const gEdges = useMemo(() => rels.map(r => [r.fromId, r.toId]), [rels])

  const suspectsList = useMemo(() => suspects.slice(0, 5), [suspects])
  const evidenceList = useMemo(() => caseEvidence.slice(0, 5), [caseEvidence])

  if (!sel) return null

  return (
    <>
      <section className="hero">
        <div className="hero__content">
          <span className="hero__eyebrow">CASE OVERVIEW</span>
          <div className="case-header__row">
            <h2 className="hero__title">{sel.title}</h2>
            <RiskBadge level={sel.status} />
            <RiskBadge level={sel.priority} />
          </div>
          <p className="case-header__meta">
            <span>{sel.id}</span>
            <span className="case-header__sep">·</span>
            <span>Lead: {sel.leadInvestigator}</span>
          </p>
          {sel.description && <p className="hero__desc">{sel.description}</p>}
        </div>
        <div className="hero__visual"><div className="hero__grid" aria-hidden="true" /></div>
      </section>

      <MetricGrid
        ariaLabel="Case metrics"
        items={[
          { id: 'suspects', label: 'Suspects', value: suspects.length, change: suspects.length === 1 ? 'Person of interest' : 'Persons of interest', icon: 'users', onClick: () => navigate('suspects') },
          { id: 'evidence', label: 'Evidence', value: caseEvidence.length, change: `${caseEvidence.length} item${caseEvidence.length !== 1 ? 's' : ''}`, icon: 'shield', onClick: () => navigate('evidence') },
          { id: 'entities', label: 'Entities', value: ents.length, change: 'Mapped nodes', icon: 'users', onClick: () => navigate('network') },
          { id: 'relationships', label: 'Relationships', value: confirmed.length, change: `${rels.length} total`, icon: 'link', onClick: () => navigate('network') },
          { id: 'locations', label: 'Locations', value: caseLocations.length, change: 'Tracked points', icon: 'location', onClick: () => navigate('map') },
          { id: 'suggestions', label: 'AI Suggestions', value: pending.length, change: 'Pending review', icon: 'ai', onClick: () => navigate('network') },
          { id: 'timeline', label: 'Timeline Events', value: timeline.filter(t => t.caseId === selectedCaseId).length, change: 'Case events', icon: 'clock', onClick: () => navigate('network') },
        ]}
      />

      <div className="dashboard-grid">
        <section className="panel">
          <header className="panel__header">
            <div><h3 className="panel__title">Suspects</h3><p className="panel__subtitle">{suspects.length} identified in this case</p></div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('suspects')}>View All <Icon name="chevron" className="icon-xs" /></button>
          </header>
          {suspectsList.length === 0 ? (
            <div className="empty-state">
              <p>No suspects identified in this case yet.</p>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => navigate('network')}>
                <Icon name="plus" className="icon-xs" /> Add Suspect
              </button>
            </div>
          ) : (
            <div className="case-list">
              {suspectsList.map(s => (
                <button key={s.id} type="button" className="case-list__item case-list__item--clickable"
                  onClick={() => navigate('suspects', { suspectId: s.id })}>
                  <div className="case-list__main">
                    <span className="case-list__name">{s.name}</span>
                    <span className="case-list__status">Person — Suspect</span>
                  </div>
                  <div className="case-list__meta"><RiskBadge level={s.risk} /></div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <header className="panel__header">
            <div><h3 className="panel__title">Evidence</h3><p className="panel__subtitle">{caseEvidence.length} item{caseEvidence.length !== 1 ? 's' : ''} collected</p></div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('evidence')}>View All <Icon name="chevron" className="icon-xs" /></button>
          </header>
          {evidenceList.length === 0 ? (
            <div className="empty-state">
              <p>No evidence has been added to this case yet.</p>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => navigate('evidence')}>
                <Icon name="plus" className="icon-xs" /> Add Evidence
              </button>
            </div>
          ) : (
            <div className="case-list">
              {evidenceList.map(e => (
                <button key={e.id} type="button" className="case-list__item case-list__item--clickable"
                  onClick={() => navigate('evidence', { evidenceId: e.id })}>
                  <div className="case-list__main">
                    <span className="case-list__name">{e.title || e.description}</span>
                    <span className="case-list__status">{e.type} · {e.date}</span>
                  </div>
                  <div className="case-list__meta">
                    <span className={`status-badge status-badge--${(e.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>{e.status || 'Pending'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <header className="panel__header">
            <div><h3 className="panel__title">Quick Actions</h3><p className="panel__subtitle">Case tools and workflows</p></div>
          </header>
          <div className="quick-actions">
            <button type="button" className="btn btn--primary" onClick={() => navigate('network')}>
              <Icon name="network" className="icon-xs" /> Open Network Analysis
            </button>
            <button type="button" className="btn btn--accent" onClick={() => runAIAnalysis(selectedCaseId)} disabled={analyzing}>
              {analyzing ? <><span className="spinner spinner--sm" /> Analyzing…</> : <><Icon name="ai" className="icon-xs" /> AI Analyze Case</>}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('reports')}>
              <Icon name="file" className="icon-xs" /> Generate Report
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('network')}>
              <Icon name="plus" className="icon-xs" /> Add Entity
            </button>
          </div>
        </section>

        {analyzing && (
          <section className="panel panel--analysis">
            <header className="panel__header">
              <div><h3 className="panel__title">AI Analysis in Progress</h3><p className="panel__subtitle">{analysisStep || 'Starting analysis…'}</p></div>
              <span className="spinner spinner--sm" />
            </header>
          </section>
        )}

        <section className="panel">
          <header className="panel__header">
            <div><h3 className="panel__title">Network Preview</h3><p className="panel__subtitle">{ents.length} entities · {rels.length} relationships</p></div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('network')}>Full Analysis <Icon name="chevron" className="icon-xs" /></button>
          </header>
          {gNodes.length > 0 ? <NetworkGraph nodes={gNodes} edges={gEdges} /> : <div className="empty-state"><p>No entities yet. Add entities to build the network.</p></div>}
        </section>

        <section className="panel">
          <header className="panel__header">
            <div><h3 className="panel__title">Recent Timeline</h3><p className="panel__subtitle">Latest case events</p></div>
          </header>
          <div className="timeline-list">
            {tl.length === 0 && <div className="empty-state"><p>No timeline events yet.</p></div>}
            {tl.map(ev => (
              <div key={ev.id} className="timeline-list__item">
                <span className="timeline-list__date">{ev.date}</span>
                <span className="timeline-list__event">{ev.event}</span>
                <span className="timeline-list__type">{ev.type}</span>
              </div>
            ))}
          </div>
        </section>

        {pending.length > 0 && (
          <section className="panel">
            <header className="panel__header">
              <div><h3 className="panel__title">Pending AI Suggestions</h3><p className="panel__subtitle">{pending.length} suggestions awaiting review</p></div>
              <button type="button" className="btn btn--accent btn--sm" onClick={() => navigate('network')}>Review Suggestions <Icon name="chevron" className="icon-xs" /></button>
            </header>
          </section>
        )}

        <section className="panel">
          <header className="panel__header">
            <div><h3 className="panel__title">Entity Summary</h3><p className="panel__subtitle">Type distribution</p></div>
          </header>
          <div className="entity-distribution">
            {dist.length === 0 && <div className="empty-state"><p>No entities in this case yet.</p></div>}
            {dist.map(([type, count]) => (
              <div key={type} className="entity-distribution__item">
                <span className="entity-distribution__dot" style={{ background: TYPE_COLORS[type] || '#94a3b8' }} />
                <span className="entity-distribution__label">{count} {type}{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function GeneralOverview() {
  const { navigate, user, cases, entities, relationships, evidence, setNewCaseModalOpen } = useApp()
  const activeCases = useMemo(() => cases.filter(c => c.status === 'Active' || c.status === 'Under Investigation'), [cases])
  const highRisk = useMemo(() => entities.filter(e => e.risk === 'HIGH' || e.risk === 'CRITICAL'), [entities])

  return (
    <>
      <section className="hero">
        <div className="hero__content">
          <span className="hero__eyebrow">CRIMINAL INTELLIGENCE PLATFORM</span>
          <h2 className="hero__title">Welcome back, {user?.name?.split(' ')[0] || 'Investigator'}</h2>
          <p className="hero__desc">
            NEXUS-CRIME maps relationships across persons, cases, and digital evidence to
            surface hidden criminal networks. You have {activeCases.length} active investigations requiring attention.
          </p>
          <div className="hero__actions">
            <button type="button" className="btn btn--primary" onClick={() => setNewCaseModalOpen(true)}>
              <Icon name="plus" className="icon-xs" /> Create Case
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('network')}>
              Network Analysis <Icon name="chevron" className="icon-xs" />
            </button>
          </div>
        </div>
        <div className="hero__visual"><div className="hero__grid" aria-hidden="true" /></div>
      </section>

      <MetricGrid
        ariaLabel="Workspace metrics"
        items={[
          { id: 'cases', label: 'Active Cases', value: activeCases.length, change: `${cases.length} total`, icon: 'folder', onClick: () => navigate('cases') },
          { id: 'entities', label: 'Entities', value: entities.length, change: `${highRisk.length} high risk`, icon: 'users', onClick: () => navigate('suspects') },
          { id: 'relationships', label: 'Relationships', value: relationships.length, change: 'Mapped connections', icon: 'link', onClick: () => navigate('network') },
          { id: 'evidence', label: 'Evidence', value: evidence.length, change: 'Total collected', icon: 'shield', onClick: () => navigate('evidence') },
        ]}
      />

      <div className="dashboard-grid">
        <section className="panel">
          <header className="panel__header">
            <div><h3 className="panel__title">Recent Cases</h3><p className="panel__subtitle">Latest case files</p></div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('cases')}>View All</button>
          </header>
          <div className="case-list">
            {cases.length === 0 && <div className="empty-state"><p>No cases yet. Create your first case.</p></div>}
            {cases.slice(0, 5).map(c => (
              <button key={c.id} type="button" className="case-list__item case-list__item--clickable"
                onClick={() => navigate('cases', { caseId: c.id })}>
                <div className="case-list__main">
                  <span className="case-list__id">{c.id}</span>
                  <span className="case-list__name">{c.title}</span>
                  <span className="case-list__status">{c.status} · {c.lastUpdated}</span>
                </div>
                <div className="case-list__meta"><RiskBadge level={c.priority} /></div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <AlertCard
            kind="Intelligence"
            icon="ai"
            title="System-wide intelligence summary"
            rows={[
              { label: 'Entities', value: `${entities.length} mapped across ${cases.length} cases` },
              { label: 'Relationships', value: `${relationships.length} direct relationships` },
              { label: 'High Risk', value: `${highRisk.length} entities require attention` },
              ...(highRisk.length > 0
                ? [{ label: 'Priority', value: <EntityChipList entities={highRisk} maxVisible={3} showStatus={false} title="High-Risk Entities" /> }]
                : []),
              ...(relationships.length === 0
                ? [{ label: 'Guidance', value: 'Add entities and relationships to enable network analysis.' }]
                : []),
            ]}
            action={relationships.length > 1 ? { label: 'Go to Network Analysis', onClick: () => navigate('network') } : undefined}
          />
        </section>
      </div>

      <section className="ai-insight">
        <div className="ai-insight__indicator">
          <Icon name="ai" className="icon-md" />
          <span className="ai-insight__pulse" aria-hidden="true" />
        </div>
        <div className="ai-insight__content">
          <span className="ai-insight__label">AI Network Insights</span>
          <p className="ai-insight__text">Select a case to view its network analysis and AI-powered recommendations.</p>
        </div>
        <button type="button" className="btn btn--accent" onClick={() => navigate('network')}>Analyze Network</button>
      </section>
    </>
  )
}

export default function Dashboard() {
  const { selectedCaseId } = useApp()
  return selectedCaseId ? <CaseOverview /> : <GeneralOverview />
}
