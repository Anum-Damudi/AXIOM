import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import MetricGrid from '../components/ui/MetricGrid'

const TYPE_COLORS = {
  PERSON: '#c2e8ff', ORGANIZATION: '#8598b8', PHONE: '#9cc4a8',
  VEHICLE: '#d9a06a', LOCATION: '#e8a09a', BANK: '#7298af',
  OTHER: '#64748b',
}
const RISK_COLORS = {
  CRITICAL: '#e8a09a', HIGH: '#e0a58f', MEDIUM: '#e3c07a', LOW: '#9cc4a8',
}

export default function Analytics() {
  const { cases, entities, relationships, intelligence, aiSuggestions, selectedCaseId, setSelectedCaseId } = useApp()

  const caseEntities = useMemo(
    () => selectedCaseId ? entities.filter(e => e.caseId === selectedCaseId) : [],
    [entities, selectedCaseId]
  )
  const caseRels = useMemo(
    () => selectedCaseId ? relationships.filter(r => r.caseId === selectedCaseId) : [],
    [relationships, selectedCaseId]
  )
  const caseIntel = useMemo(
    () => selectedCaseId ? intelligence.filter(i => i.caseId === selectedCaseId) : [],
    [intelligence, selectedCaseId]
  )
  const caseAi = useMemo(
    () => selectedCaseId ? aiSuggestions.filter(a => a.caseId === selectedCaseId) : [],
    [aiSuggestions, selectedCaseId]
  )

  const entityTypeDist = useMemo(() => {
    const dist = {}
    caseEntities.forEach(e => { const t = (e.type || 'OTHER').toUpperCase(); dist[t] = (dist[t] || 0) + 1 })
    const all = ['PERSON', 'ORGANIZATION', 'PHONE', 'VEHICLE', 'LOCATION', 'BANK', 'OTHER']
    return all.map(type => ({ type, count: dist[type] || 0 })).filter(d => d.count > 0)
      .concat(all.filter(t => !dist[t]).map(type => ({ type, count: 0 })))
  }, [caseEntities])

  const riskDist = useMemo(() => {
    const dist = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    caseEntities.forEach(e => { const r = (e.risk || 'LOW').toUpperCase(); dist[r] = (dist[r] || 0) + 1 })
    return [
      { label: 'CRITICAL', count: dist.CRITICAL, color: RISK_COLORS.CRITICAL },
      { label: 'HIGH', count: dist.HIGH, color: RISK_COLORS.HIGH },
      { label: 'MEDIUM', count: dist.MEDIUM, color: RISK_COLORS.MEDIUM },
      { label: 'LOW', count: dist.LOW, color: RISK_COLORS.LOW },
    ]
  }, [caseEntities])

  const relTypeDist = useMemo(() => {
    const dist = {}
    caseRels.forEach(r => { const t = r.type || 'OTHER'; dist[t] = (dist[t] || 0) + 1 })
    return Object.entries(dist)
      .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count }))
      .sort((a, b) => b.count - a.count)
  }, [caseRels])

  const topConnected = useMemo(() => {
    const counts = {}
    caseRels.forEach(r => {
      counts[r.fromId] = (counts[r.fromId] || 0) + 1
      counts[r.toId] = (counts[r.toId] || 0) + 1
    })
    return Object.entries(counts)
      .map(([id, count]) => {
        const ent = caseEntities.find(e => e.id === id)
        return ent ? { id, name: ent.name, type: ent.type, count } : null
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [caseEntities, caseRels])

  const aiConfDist = useMemo(() => {
    const high = caseAi.filter(a => a.confidence > 80).length
    const med = caseAi.filter(a => a.confidence >= 60 && a.confidence <= 80).length
    const low = caseAi.filter(a => a.confidence < 60).length
    return [
      { label: 'High (>80%)', count: high, color: '#22c55e' },
      { label: 'Medium (60-80%)', count: med, color: '#f59e0b' },
      { label: 'Low (<60%)', count: low, color: '#ef4444' },
    ]
  }, [caseAi])

  const netStats = useMemo(() => {
    const totalNodes = caseEntities.length
    const totalEdges = caseRels.length
    const density = totalNodes > 1 ? ((2 * totalEdges) / (totalNodes * (totalNodes - 1))).toFixed(4) : '0.0000'
    const avgConn = totalNodes > 0 ? (totalEdges / totalNodes).toFixed(1) : '0.0'
    return { totalNodes, totalEdges, density, avgConn }
  }, [caseEntities, caseRels])

  const maxType = Math.max(...entityTypeDist.map(d => d.count), 1)
  const maxRel = Math.max(...relTypeDist.map(d => d.count), 1)
  const maxRisk = Math.max(...riskDist.map(d => d.count), 1)
  const maxAi = Math.max(...aiConfDist.map(d => d.count), 1)

  if (!selectedCaseId) {
    return (
      <div className="page-content">
        <header className="page-header">
          <div><h1>Analytics</h1><p className="page-header__desc">Investigation analytics and metrics</p></div>
        </header>
        <div className="empty-state">
          <p>Select a case to view analytics.</p>
        </div>
      </div>
    )
  }

  const activeCase = cases.find(c => c.id === selectedCaseId)

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="page-header__desc">{activeCase ? `Analytics for ${activeCase.title}` : 'Investigation analytics and metrics'}</p>
        </div>
        <div className="page-header__actions">
          <select className="toolbar__select" value={selectedCaseId || ''} onChange={e => setSelectedCaseId(e.target.value || null)}>
            <option value="">Select Case</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
          </select>
        </div>
      </header>

      <MetricGrid
        ariaLabel="Investigation analytics"
        items={[
          { id: 'entities', label: 'Entities', value: caseEntities.length, change: `${caseEntities.filter(e => e.risk === 'HIGH' || e.risk === 'CRITICAL').length} high risk`, icon: 'users' },
          { id: 'relationships', label: 'Relationships', value: caseRels.length, change: `${netStats.avgConn} avg connections`, icon: 'link' },
          { id: 'intelligence', label: 'Intelligence Items', value: caseIntel.length, change: `${new Set(caseIntel.map(i => i.source)).size} sources`, icon: 'shield' },
          { id: 'suggestions', label: 'AI Suggestions', value: caseAi.length, change: `${caseAi.filter(a => a.status === 'ACCEPTED').length} accepted`, icon: 'ai' },
        ]}
      />

      <div className="analytics-grid">
        <section className="panel analytics-chart">
          <header className="panel__header">
            <h3 className="panel__title">Entity Type Distribution</h3>
          </header>
          <div className="chart-area">
            {entityTypeDist.length > 0 ? (
              <div className="horizontal-bar-chart">
                {entityTypeDist.map(d => (
                  <div key={d.type} className="horizontal-bar-chart__row">
                    <span className="horizontal-bar-chart__label">{d.type}</span>
                    <div className="horizontal-bar-chart__track">
                      <div className="horizontal-bar-chart__fill" style={{ width: `${maxType > 0 ? (d.count / maxType) * 100 : 0}%`, background: TYPE_COLORS[d.type] || '#64748b' }} />
                    </div>
                    <span className="horizontal-bar-chart__value">{d.count}</span>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state"><p>No entities in this case.</p></div>}
          </div>
        </section>

        <section className="panel analytics-chart">
          <header className="panel__header">
            <h3 className="panel__title">Risk Distribution</h3>
          </header>
          <div className="chart-area">
            <div className="horizontal-bar-chart">
              {riskDist.map(d => (
                <div key={d.label} className="horizontal-bar-chart__row">
                  <span className="horizontal-bar-chart__label">{d.label}</span>
                  <div className="horizontal-bar-chart__track">
                    <div className="horizontal-bar-chart__fill" style={{ width: `${maxRisk > 0 ? (d.count / maxRisk) * 100 : 0}%`, background: d.color }} />
                  </div>
                  <span className="horizontal-bar-chart__value">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel analytics-chart">
          <header className="panel__header">
            <h3 className="panel__title">Relationship Type Distribution</h3>
          </header>
          <div className="chart-area">
            {relTypeDist.length > 0 ? (
              <div className="horizontal-bar-chart">
                {relTypeDist.map(d => (
                  <div key={d.type} className="horizontal-bar-chart__row">
                    <span className="horizontal-bar-chart__label">{d.type}</span>
                    <div className="horizontal-bar-chart__track">
                      <div className="horizontal-bar-chart__fill" style={{ width: `${(d.count / maxRel) * 100}%`, background: '#0891b2' }} />
                    </div>
                    <span className="horizontal-bar-chart__value">{d.count}</span>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state"><p>No relationships in this case.</p></div>}
          </div>
        </section>

        <section className="panel analytics-chart">
          <header className="panel__header">
            <h3 className="panel__title">Top Connected Entities</h3>
          </header>
          <div className="chart-area">
            {topConnected.length > 0 ? (
              <div className="horizontal-bar-chart">
                {topConnected.map(e => (
                  <div key={e.id} className="horizontal-bar-chart__row">
                    <span className="horizontal-bar-chart__label" title={`${e.name} (${e.type})`}>{e.name}</span>
                    <div className="horizontal-bar-chart__track">
                      <div className="horizontal-bar-chart__fill" style={{ width: `${(e.count / topConnected[0].count) * 100}%`, background: TYPE_COLORS[e.type] || '#64748b' }} />
                    </div>
                    <span className="horizontal-bar-chart__value">{e.count}</span>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state"><p>No connections found.</p></div>}
          </div>
        </section>

        <section className="panel analytics-chart">
          <header className="panel__header">
            <h3 className="panel__title">AI Confidence Distribution</h3>
          </header>
          <div className="chart-area">
            {caseAi.length > 0 ? (
              <div className="horizontal-bar-chart">
                {aiConfDist.map(d => (
                  <div key={d.label} className="horizontal-bar-chart__row">
                    <span className="horizontal-bar-chart__label">{d.label}</span>
                    <div className="horizontal-bar-chart__track">
                      <div className="horizontal-bar-chart__fill" style={{ width: `${maxAi > 0 ? (d.count / maxAi) * 100 : 0}%`, background: d.color }} />
                    </div>
                    <span className="horizontal-bar-chart__value">{d.count}</span>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state"><p>No AI suggestions for this case.</p></div>}
          </div>
        </section>

        <section className="panel analytics-chart">
          <header className="panel__header">
            <h3 className="panel__title">Network Statistics</h3>
          </header>
          <div className="chart-area">
            <MetricGrid
              minWidth="8rem"
              ariaLabel="Network statistics"
              items={[
                { id: 'nodes', label: 'Total Nodes', value: netStats.totalNodes },
                { id: 'edges', label: 'Total Edges', value: netStats.totalEdges },
                { id: 'density', label: 'Density', value: netStats.density },
                { id: 'average', label: 'Avg Connections', value: netStats.avgConn },
              ]}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
