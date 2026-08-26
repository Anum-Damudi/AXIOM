import { RECENT_INVESTIGATIONS, SUSPECTS, EVIDENCE, NETWORK_NODES, INVESTIGATIONS } from '../data/mockData'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import NetworkGraph from '../components/NetworkGraph'
import RiskBadge from '../components/RiskBadge'
import StatCard from '../components/StatCard'

export default function Dashboard() {
  const { navigate, user } = useApp()
  const activeCases = INVESTIGATIONS.filter((c) => c.status === 'Active')
  const priorityEntities = SUSPECTS.filter((s) => s.risk === 'HIGH' || s.risk === 'MEDIUM')
  const pendingReview = EVIDENCE.filter((e) => e.status === 'Pending')

  const stats = [
    { id: 'cases', label: 'Active Cases', value: String(activeCases.length), change: 'Currently assigned', icon: 'folder', navigateTo: 'cases' },
    { id: 'entities', label: 'Priority Entities', value: String(priorityEntities.length), change: 'Requiring surveillance', icon: 'users', navigateTo: 'suspects' },
    { id: 'evidence', label: 'Pending Review', value: String(pendingReview.length), change: 'Evidence items', icon: 'shield', navigateTo: 'evidence' },
    { id: 'network', label: 'Network Links', value: String(NETWORK_NODES.length), change: `${INVESTIGATIONS.length} investigations`, icon: 'network', navigateTo: 'network' },
  ]

  const insights = [
    'Rajesh K. has unusually high network centrality — recommend expanding traversal.',
    'Three entities share a common location in the Mumbai warehouse district.',
    'A financial relationship connects two previously separate investigation clusters.',
    'Organization ORG-204 is connected to 5 investigated entities.',
  ]

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
            <button type="button" className="btn btn--primary" onClick={() => navigate('network')}>
              Network Analysis
              <Icon name="chevron" className="icon-xs" />
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('cases')}>
              View Cases
            </button>
          </div>
        </div>
        <div className="hero__visual">
          <div className="hero__grid" aria-hidden="true" />
        </div>
      </section>

      <section className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} onClick={() => navigate(stat.navigateTo)} />
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Criminal Network Overview</h3>
              <p className="panel__subtitle">Active syndicate — Operation Shadow Ledger</p>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('network')}>
              Full Analysis
            </button>
          </header>
          <NetworkGraph />
        </section>

        <section className="panel">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Recent Investigations</h3>
              <p className="panel__subtitle">Latest active case files</p>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('cases')}>
              View All Cases
            </button>
          </header>
          <div className="case-list">
            {RECENT_INVESTIGATIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="case-list__item case-list__item--clickable"
                onClick={() => navigate('cases', { caseId: item.id })}
              >
                <div className="case-list__main">
                  <span className="case-list__id">{item.id}</span>
                  <span className="case-list__name">{item.name}</span>
                  <span className="case-list__status">{item.status} · {item.lastActivity}</span>
                </div>
                <div className="case-list__meta">
                  <span className="case-list__connections">{item.connections} connected</span>
                  <RiskBadge level={item.risk} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="ai-insight">
        <div className="ai-insight__indicator">
          <Icon name="ai" className="icon-md" />
          <span className="ai-insight__pulse" aria-hidden="true" />
        </div>
        <div className="ai-insight__content">
          <span className="ai-insight__label">AI Network Insights</span>
          <div className="ai-insight__list">
            {insights.map((text, i) => (
              <p key={i} className="ai-insight__text">{text}</p>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn--accent" onClick={() => navigate('network', { suspectId: 'SUS-0041' })}>
          Analyze Connection
        </button>
      </section>
    </>
  )
}
