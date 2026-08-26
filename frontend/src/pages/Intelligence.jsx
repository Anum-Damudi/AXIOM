import { SUSPECTS, INVESTIGATIONS, EVIDENCE, NETWORK_NODES } from '../data/mockData'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import RiskBadge from '../components/RiskBadge'

const FINDINGS = [
  { id: 1, type: 'Financial', risk: 'HIGH', text: '₹2.4 Cr flagged transaction linked to offshore account #4471 — Rajesh K. primary suspect.', caseId: 'NX-2026-041', time: '2 hours ago' },
  { id: 2, type: 'Communication', risk: 'CRITICAL', text: 'Encrypted messaging metadata reveals new communication channel between Ghost Wire and unknown third party.', caseId: 'NX-2026-037', time: '5 hours ago' },
  { id: 3, type: 'Location', risk: 'MEDIUM', text: 'GPS cluster analysis identifies recurring vehicle presence at Mumbai warehouse district.', caseId: 'NX-2026-029', time: '1 day ago' },
  { id: 4, type: 'Network', risk: 'HIGH', text: 'New high-centrality node identified — Rohan Mehta connected to 22 entities in Shadow Ledger network.', caseId: 'NX-2026-041', time: '1 day ago' },
  { id: 5, type: 'Evidence', risk: 'MEDIUM', text: 'Digital forensics on EVD-8821 reveals encrypted communication artifacts from suspect workstation.', caseId: 'NX-2026-041', time: '2 days ago' },
  { id: 6, type: 'Financial', risk: 'LOW', text: 'Cross-referencing bank records shows transaction pattern consistent with layering technique.', caseId: 'NX-2026-024', time: '3 days ago' },
]

const ALERTS = [
  { id: 1, severity: 'critical', text: 'New encrypted channel detected — potential communication blackout imminent.', caseId: 'NX-2026-037', time: '10 min ago' },
  { id: 2, severity: 'high', text: 'Offshore account #4471 showing rapid fund movement — ₹48L in 24 hours.', caseId: 'NX-2026-041', time: '1 hour ago' },
  { id: 3, severity: 'medium', text: 'Suspect Rohan Mehta location data inconsistent with stated alibi.', caseId: 'NX-2026-041', time: '3 hours ago' },
  { id: 4, severity: 'low', text: 'Case NX-2026-029 review deadline approaching — 48 hours remaining.', caseId: 'NX-2026-029', time: '6 hours ago' },
]

export default function Intelligence() {
  const { navigate } = useApp()
  const activeInvestigations = INVESTIGATIONS.filter((i) => i.status === 'Active')
  const sortedSuspects = [...SUSPECTS].sort((a, b) => b.riskScore - a.riskScore)

  const stats = [
    { id: 'entities', label: 'Total Entities', value: String(SUSPECTS.length), change: 'Persons of interest', icon: 'users' },
    { id: 'investigations', label: 'Active Investigations', value: String(activeInvestigations.length), change: 'Currently open', icon: 'network' },
    { id: 'evidence', label: 'Evidence Items', value: String(EVIDENCE.length), change: 'Under review', icon: 'shield' },
    { id: 'network', label: 'Network Nodes', value: String(NETWORK_NODES.length), change: 'Mapped connections', icon: 'link' },
  ]

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Intelligence Hub</h1>
          <p className="page-header__desc">Central intelligence for active investigations</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--ghost btn--sm"><Icon name="filter" className="icon-xs" />Filter</button>
        </div>
      </header>

      <section className="stats-grid">
        {stats.map(stat => (
          <div key={stat.id} className="stat-card">
            <div className="stat-card__icon"><Icon name={stat.icon} className="icon-md" /></div>
            <div className="stat-card__info">
              <span className="stat-card__value">{stat.value}</span>
              <span className="stat-card__label">{stat.label}</span>
              <span className="stat-card__change">{stat.change}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Persons of Interest</h3>
              <p className="panel__subtitle">High-priority suspects under investigation</p>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('suspects')}>View All</button>
          </header>
          <div className="case-list">
            {sortedSuspects.map(s => (
              <button key={s.id} type="button" className="case-list__item case-list__item--clickable" onClick={() => navigate('suspects', { suspectId: s.id })}>
                <div className="case-list__main">
                  <span className="case-list__name">{s.name}{s.alias ? ` (${s.alias})` : ''}</span>
                  <span className="case-list__meta">Risk Score: {s.riskScore} · {s.connections} connections</span>
                </div>
                <div className="case-list__meta">
                  <RiskBadge level={s.risk} />
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Key Findings</h3>
              <p className="panel__subtitle">Recent intelligence discoveries</p>
            </div>
          </header>
          <div className="panel__body">
            {FINDINGS.map(finding => (
              <div key={finding.id} className="intel-finding">
                <div className="intel-finding__header">
                  <span className="intel-finding__type">{finding.type}</span>
                  <RiskBadge level={finding.risk} />
                </div>
                <p className="intel-finding__text">{finding.text}</p>
                <span className="intel-finding__meta">{finding.caseId} · {finding.time}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <header className="panel__header">
          <div>
            <h3 className="panel__title">Active Intelligence Alerts</h3>
            <p className="panel__subtitle">Priority alerts requiring attention</p>
          </div>
        </header>
        <div className="intel-alerts-grid">
          {ALERTS.map(alert => (
            <div key={alert.id} className={`intel-alert intel-alert--${alert.severity}`}>
              <div className="intel-alert__header">
                <Icon name="alert" className="icon-sm" />
                <span className="intel-alert__severity">{alert.severity}</span>
                <span className="intel-alert__time">{alert.time}</span>
              </div>
              <p className="intel-alert__text">{alert.text}</p>
              <span className="intel-alert__case">{alert.caseId}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
