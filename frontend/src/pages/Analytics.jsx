import { useState } from 'react'
import Icon from '../components/Icon'
import { CASES, SUSPECTS, EVIDENCE, NETWORK_NODES, NETWORK_EDGES } from '../data/mockData'

const MONTHLY_DATA = [
  { month: 'Apr', cases: 3, entities: 12, evidence: 8 },
  { month: 'May', cases: 5, entities: 18, evidence: 14 },
  { month: 'Jun', cases: 4, entities: 22, evidence: 11 },
  { month: 'Jul', cases: 7, entities: 31, evidence: 19 },
  { month: 'Aug', cases: 9, entities: 47, evidence: 26 },
]

const RISK_DISTRIBUTION = [
  { label: 'HIGH', count: SUSPECTS.filter(s => s.risk === 'HIGH').length, color: 'var(--risk-high)' },
  { label: 'MEDIUM', count: SUSPECTS.filter(s => s.risk === 'MEDIUM').length, color: 'var(--risk-medium)' },
  { label: 'LOW', count: SUSPECTS.filter(s => s.risk === 'LOW').length, color: 'var(--risk-low)' },
]

const ALERT_TRENDS = [
  { week: 'W1', critical: 2, high: 4, medium: 6, low: 3 },
  { week: 'W2', critical: 3, high: 5, medium: 4, low: 5 },
  { week: 'W3', critical: 1, high: 6, medium: 7, low: 4 },
  { week: 'W4', critical: 4, high: 3, medium: 5, low: 2 },
]

const ENTITY_TYPES = NETWORK_NODES.reduce((acc, n) => {
  const existing = acc.find(a => a.type === n.type)
  if (existing) existing.count++
  else acc.push({ type: n.type, count: 1 })
  return acc
}, [])

export default function Analytics() {
  const [timeRange, setTimeRange] = useState('30d')

  const activeCases = CASES.filter(c => c.status === 'Active').length
  const maxMonthly = Math.max(...MONTHLY_DATA.map(d => Math.max(d.cases, d.entities, d.evidence)))
  const maxAlerts = Math.max(...ALERT_TRENDS.map(d => d.critical + d.high + d.medium + d.low))

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="page-header__desc">Investigation analytics and performance metrics</p>
        </div>
        <div className="page-header__actions">
          <select className="toolbar__select" value={timeRange} onChange={e => setTimeRange(e.target.value)}>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__icon"><Icon name="folder" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{CASES.length}</span>
            <span className="stat-card__label">Total Cases</span>
            <span className="stat-card__change">{activeCases} active</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon"><Icon name="users" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{SUSPECTS.length}</span>
            <span className="stat-card__label">Entities Tracked</span>
            <span className="stat-card__change">{SUSPECTS.filter(s => s.risk === 'HIGH').length} high risk</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon"><Icon name="network" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{NETWORK_EDGES.length}</span>
            <span className="stat-card__label">Network Edges</span>
            <span className="stat-card__change">{NETWORK_NODES.length} nodes mapped</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon"><Icon name="shield" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{EVIDENCE.length}</span>
            <span className="stat-card__label">Evidence Items</span>
            <span className="stat-card__change">{EVIDENCE.filter(e => e.status === 'Pending').length} pending</span>
          </div>
        </div>
      </section>

      <div className="analytics-grid">
        <section className="panel analytics-chart">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Investigation Trends</h3>
              <p className="panel__subtitle">Monthly case activity and entity discovery</p>
            </div>
          </header>
          <div className="chart-area">
            <div className="bar-chart">
              {MONTHLY_DATA.map(d => (
                <div key={d.month} className="bar-chart__group">
                  <div className="bar-chart__bars">
                    <div className="bar-chart__bar bar-chart__bar--primary" style={{ height: `${(d.cases / maxMonthly) * 100}%` }} title={`${d.cases} cases`}>
                      <span className="bar-chart__bar-value">{d.cases}</span>
                    </div>
                    <div className="bar-chart__bar bar-chart__bar--accent" style={{ height: `${(d.entities / maxMonthly) * 100}%` }} title={`${d.entities} entities`}>
                      <span className="bar-chart__bar-value">{d.entities}</span>
                    </div>
                    <div className="bar-chart__bar bar-chart__bar--success" style={{ height: `${(d.evidence / maxMonthly) * 100}%` }} title={`${d.evidence} evidence`}>
                      <span className="bar-chart__bar-value">{d.evidence}</span>
                    </div>
                  </div>
                  <span className="bar-chart__label">{d.month}</span>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span className="chart-legend__item"><span className="chart-legend__dot chart-legend__dot--primary" />Cases</span>
              <span className="chart-legend__item"><span className="chart-legend__dot chart-legend__dot--accent" />Entities</span>
              <span className="chart-legend__item"><span className="chart-legend__dot chart-legend__dot--success" />Evidence</span>
            </div>
          </div>
        </section>

        <section className="panel analytics-chart">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Risk Distribution</h3>
              <p className="panel__subtitle">Entity risk level breakdown</p>
            </div>
          </header>
          <div className="chart-area">
            <div className="donut-chart">
              {(() => {
                const total = RISK_DISTRIBUTION.reduce((s, r) => s + r.count, 0)
                const circumference = 251.327
                const segments = RISK_DISTRIBUTION.reduce((acc, r) => {
                  const pct = (r.count / total) * 100
                  const dash = pct * (circumference / 100)
                  const dashOffset = -(acc.offset) * (circumference / 100)
                  acc.items.push({ ...r, dash, dashOffset })
                  acc.offset += pct
                  return acc
                }, { items: [], offset: 0 }).items
                return (
                  <div className="donut-chart__ring">
                    <svg viewBox="0 0 120 120" className="donut-chart__svg">
                      {segments.map((s, i) => (
                        <circle key={i} cx="60" cy="60" r="40" fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${s.dash} ${circumference - s.dash}`} strokeDashoffset={s.dashOffset} className="donut-chart__segment" />
                      ))}
                    </svg>
                    <div className="donut-chart__center">
                      <span className="donut-chart__total">{total}</span>
                      <span className="donut-chart__label">Entities</span>
                    </div>
                  </div>
                )
              })()}
              <div className="donut-chart__legend">
                {RISK_DISTRIBUTION.map(r => (
                  <div key={r.label} className="donut-chart__legend-item">
                    <span className="donut-chart__legend-dot" style={{ background: r.color }} />
                    <span className="donut-chart__legend-label">{r.label}</span>
                    <span className="donut-chart__legend-count">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel analytics-chart">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Alert Trends</h3>
              <p className="panel__subtitle">Weekly alert volume by severity</p>
            </div>
          </header>
          <div className="chart-area">
            <div className="stacked-bar-chart">
              {ALERT_TRENDS.map(d => (
                <div key={d.week} className="stacked-bar-chart__group">
                  <div className="stacked-bar-chart__bar-container">
                    <div className="stacked-bar-chart__segment stacked-bar-chart__segment--critical" style={{ height: `${(d.critical / maxAlerts) * 100}%` }} title={`${d.critical} critical`} />
                    <div className="stacked-bar-chart__segment stacked-bar-chart__segment--high" style={{ height: `${(d.high / maxAlerts) * 100}%` }} title={`${d.high} high`} />
                    <div className="stacked-bar-chart__segment stacked-bar-chart__segment--medium" style={{ height: `${(d.medium / maxAlerts) * 100}%` }} title={`${d.medium} medium`} />
                    <div className="stacked-bar-chart__segment stacked-bar-chart__segment--low" style={{ height: `${(d.low / maxAlerts) * 100}%` }} title={`${d.low} low`} />
                  </div>
                  <span className="stacked-bar-chart__label">{d.week}</span>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span className="chart-legend__item"><span className="chart-legend__dot" style={{ background: 'var(--risk-high)' }} />Critical</span>
              <span className="chart-legend__item"><span className="chart-legend__dot" style={{ background: '#f97316' }} />High</span>
              <span className="chart-legend__item"><span className="chart-legend__dot" style={{ background: 'var(--risk-medium)' }} />Medium</span>
              <span className="chart-legend__item"><span className="chart-legend__dot" style={{ background: 'var(--risk-low)' }} />Low</span>
            </div>
          </div>
        </section>

        <section className="panel analytics-chart">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Entity Types</h3>
              <p className="panel__subtitle">Network node type distribution</p>
            </div>
          </header>
          <div className="chart-area">
            <div className="horizontal-bar-chart">
              {ENTITY_TYPES.map(t => (
                <div key={t.type} className="horizontal-bar-chart__row">
                  <span className="horizontal-bar-chart__label">{t.type}</span>
                  <div className="horizontal-bar-chart__track">
                    <div className="horizontal-bar-chart__fill" style={{ width: `${(t.count / Math.max(...ENTITY_TYPES.map(e => e.count))) * 100}%` }} />
                  </div>
                  <span className="horizontal-bar-chart__value">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="panel analytics-chart">
        <header className="panel__header">
          <div>
            <h3 className="panel__title">Case Status Summary</h3>
            <p className="panel__subtitle">Current investigation status distribution</p>
          </div>
        </header>
        <div className="case-status-grid">
          {['Active', 'Under Investigation', 'Review', 'Closed'].map(status => {
            const count = CASES.filter(c => c.status === status).length
            const pct = CASES.length > 0 ? Math.round((count / CASES.length) * 100) : 0
            return (
              <div key={status} className="case-status-card">
                <div className="case-status-card__header">
                  <span className="case-status-card__label">{status}</span>
                  <span className="case-status-card__count">{count}</span>
                </div>
                <div className="case-status-card__bar">
                  <div className="case-status-card__fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="case-status-card__pct">{pct}%</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
