import { useState, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { exportReportPdf, downloadPdf } from '../utils/exportPdf'

function buildReportData(activeCase, entities, relationships, intelligence, evidence, aiSuggestions, timeline) {
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  const caseEntities = entities.filter(e => e.caseId === activeCase.id)
  const caseRels = relationships.filter(r => r.caseId === activeCase.id)
  const caseIntel = intelligence.filter(i => i.caseId === activeCase.id)
  const caseEvidence = evidence.filter(e => e.caseId === activeCase.id)
  const caseAi = aiSuggestions.filter(a => a.caseId === activeCase.id)
  const caseTl = timeline.filter(t => t.caseId === activeCase.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const caseSuspects = caseEntities.filter(e => e.type === 'Person' && e.role === 'Suspect')

  const totalNodes = caseEntities.length || 1
  const totalEdges = caseRels.length
  const avgConnections = totalNodes > 0 ? Math.round((totalEdges / totalNodes) * 10) / 10 : 0

  const connections = caseRels.map(r => {
    const from = caseEntities.find(e => e.id === r.fromId)
    const to = caseEntities.find(e => e.id === r.toId)
    return from && to ? `${from.name} ↔ ${to.name}` : null
  }).filter(Boolean)

  const findings = [
    `${activeCase.title} involves ${totalNodes} mapped entities.`,
    `${caseRels.length} direct relationships mapped across the network.`,
    `Network density is ${totalNodes > 1 ? ((2 * totalEdges) / (totalNodes * (totalNodes - 1))).toFixed(4) : '0'}.`,
    `${caseIntel.length} intelligence items collected from ${new Set(caseIntel.map(i => i.source)).size} sources.`,
    `${caseEvidence.length} evidence items collected and catalogued.`,
    `${caseSuspects.length} suspects identified in this case.`,
    `${caseAi.length} AI suggestions generated, ${caseAi.filter(a => a.status === 'ACCEPTED').length} accepted.`,
  ]

  const riskIndicators = []
  if (activeCase.risk === 'HIGH' || activeCase.risk === 'CRITICAL') riskIndicators.push(`Case risk level is ${activeCase.risk}.`)
  riskIndicators.push(`${caseEntities.filter(e => e.risk === 'HIGH' || e.risk === 'CRITICAL').length} high/critical risk entities identified.`)
  riskIndicators.push(`${totalEdges} network relationships mapped. ${avgConnections} avg connections per node.`)

  const recommendations = [
    'Maintain active surveillance on all linked suspects, prioritizing high-risk individuals.',
    'Expand network traversal to identify second-degree connections.',
    'Schedule weekly review meeting to assess investigation progress.',
    'Prepare case file for judicial review — target completion within 14 days.',
  ]

  return {
    id: `RPT-${Date.now()}`,
    title: `${activeCase.title} — Investigation Report`,
    caseId: activeCase.id, caseTitle: activeCase.title,
    type: 'Investigation Report', status: 'Generated',
    priority: activeCase.priority, riskLevel: activeCase.risk,
    investigator: activeCase.leadInvestigator,
    generatedAt: timestamp, createdAt: timestamp,
    executiveSummary: activeCase.description || `Investigation report for ${activeCase.title}.`,
    summary: activeCase.description || 'Investigation report.',
    investigationStatus: `The investigation into ${activeCase.title} is currently ${(activeCase.status || 'active').toLowerCase()}.`,
    timeline: caseTl, findings,
    suspects: caseSuspects.map(s => ({ id: s.id, name: s.name, role: s.role, risk: s.risk, description: s.description })),
    locations: [],
    network: { totalNodes, totalEdges, avgConnections, findings: [
      `${totalNodes} entities identified.`, `${totalEdges} direct relationships mapped.`,
      `Average degree: ${avgConnections} connections per entity.`, 'Cluster analysis reveals operational groups.',
    ]},
    evidence: caseEvidence.map(e => ({ id: e.id, title: e.title, description: e.description, type: e.type, status: e.status, date: e.date, source: e.source })),
    connections, riskIndicators, recommendations,
    conclusion: `This report consolidates intelligence for ${activeCase.title}. ${totalNodes} entities and ${totalEdges} relationships mapped. ${caseEvidence.length} evidence items and ${caseSuspects.length} suspects documented.`,
  }
}

export default function Reports() {
  const { cases, entities, relationships, intelligence, evidence, aiSuggestions, timeline, selectedCaseId, setSelectedCaseId, showToast } = useApp()
  const [generating, setGenerating] = useState(false)

  const selectedCase = useMemo(
    () => selectedCaseId ? cases.find(c => c.id === selectedCaseId) || null : null,
    [cases, selectedCaseId]
  )

  const caseEntities = useMemo(
    () => selectedCaseId ? entities.filter(e => e.caseId === selectedCaseId) : [],
    [entities, selectedCaseId]
  )
  const caseSuspects = useMemo(
    () => caseEntities.filter(e => e.type === 'Person' && e.role === 'Suspect'),
    [caseEntities]
  )
  const caseEvidence = useMemo(
    () => selectedCaseId ? evidence.filter(e => e.caseId === selectedCaseId) : [],
    [evidence, selectedCaseId]
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
  const caseTl = useMemo(
    () => selectedCaseId ? timeline.filter(t => t.caseId === selectedCaseId) : [],
    [timeline, selectedCaseId]
  )

  const entityTypeBreakdown = useMemo(() => {
    const dist = {}
    caseEntities.forEach(e => { const t = e.type || 'Other'; dist[t] = (dist[t] || 0) + 1 })
    return Object.entries(dist).sort((a, b) => b[1] - a[1])
  }, [caseEntities])

  const aiStatusCounts = useMemo(() => ({
    accepted: caseAi.filter(a => a.status === 'ACCEPTED').length,
    rejected: caseAi.filter(a => a.status === 'REJECTED').length,
    pending: caseAi.filter(a => !a.status || a.status === 'PENDING').length,
  }), [caseAi])

  const intelSources = useMemo(() => new Set(caseIntel.map(i => i.source)).size, [caseIntel])

  const tlRange = useMemo(() => {
    if (caseTl.length === 0) return null
    const sorted = [...caseTl].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    return { start: sorted[0].date, end: sorted[sorted.length - 1].date }
  }, [caseTl])

  const handleGenerate = useCallback(() => {
    if (!selectedCase) { showToast('Select a case to generate a report.', 'error'); return }
    setGenerating(true)
    setTimeout(() => {
      try {
        const report = buildReportData(selectedCase, entities, relationships, intelligence, evidence, aiSuggestions, timeline)
        const doc = exportReportPdf(report)
        downloadPdf(doc, `AXIOM-${selectedCase.id}-Report.pdf`)
        showToast(`Report generated for ${selectedCase.title}`, 'success')
      } catch (err) {
        console.error(err)
        showToast('Failed to generate report.', 'error')
      } finally { setGenerating(false) }
    }, 800)
  }, [selectedCase, entities, relationships, intelligence, evidence, aiSuggestions, timeline, showToast])

  if (!selectedCaseId) {
    return (
      <div className="page-content">
        <header className="page-header">
          <div><h1>Reports</h1><p className="page-header__desc">Generate and manage investigation reports</p></div>
        </header>
        <div className="empty-state">
          <p>Select a case to generate a report.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="page-header__desc">{selectedCase ? `Report for ${selectedCase.title}` : 'Generate and manage investigation reports'}</p>
        </div>
        <div className="page-header__actions">
          <select className="toolbar__select" value={selectedCaseId || ''} onChange={e => setSelectedCaseId(e.target.value || null)}>
            <option value="">Select Case</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
          </select>
          <button className="btn btn--primary btn--sm" onClick={handleGenerate} disabled={generating || !selectedCaseId}>
            {generating ? <span className="btn__spinner" /> : null}
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </header>

      <section className="panel" style={{ marginBottom: '1.5rem' }}>
        <header className="panel__header">
          <h3 className="panel__title">Report Preview</h3>
        </header>
        <div style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {selectedCase && (
              <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border, #e2e8f0)' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-primary, #0f172a)' }}>Case Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary, #334155)' }}>
                  <div><strong>Case ID:</strong> {selectedCase.id}</div>
                  <div><strong>Title:</strong> {selectedCase.title}</div>
                  <div><strong>Status:</strong> {selectedCase.status}</div>
                  <div><strong>Priority:</strong> {selectedCase.priority}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong>Description:</strong> {selectedCase.description || 'No description provided.'}</div>
                </div>
              </div>
            )}

            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border, #e2e8f0)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-primary, #0f172a)' }}>Suspects</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)' }}>
                <strong>Total:</strong> {caseSuspects.length} suspect{caseSuspects.length !== 1 ? 's' : ''} identified
                {caseSuspects.length > 0 && (
                  <div style={{ marginTop: '0.25rem' }}>
                    {caseSuspects.map(s => s.name).join(', ')}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border, #e2e8f0)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-primary, #0f172a)' }}>Evidence Summary</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)' }}>
                <strong>Total:</strong> {caseEvidence.length} evidence item{caseEvidence.length !== 1 ? 's' : ''}
                {caseEvidence.length > 0 && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <strong>Types:</strong> {[...new Set(caseEvidence.map(e => e.type))].join(', ')}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border, #e2e8f0)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-primary, #0f172a)' }}>Entities Summary</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)' }}>
                <div><strong>Total:</strong> {caseEntities.length} entities</div>
                {entityTypeBreakdown.length > 0 && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <strong>By type:</strong> {entityTypeBreakdown.map(([t, c]) => `${t} (${c})`).join(', ')}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border, #e2e8f0)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-primary, #0f172a)' }}>Confirmed Relationships</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)' }}>
                <strong>Total:</strong> {caseRels.length} relationships mapped
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border, #e2e8f0)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-primary, #0f172a)' }}>AI Suggestions</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)' }}>
                <strong>Total:</strong> {caseAi.length} suggestions — {' '}
                <span style={{ color: '#22c55e' }}>{aiStatusCounts.accepted} accepted</span>, {' '}
                <span style={{ color: '#ef4444' }}>{aiStatusCounts.rejected} rejected</span>, {' '}
                <span style={{ color: '#f59e0b' }}>{aiStatusCounts.pending} pending</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border, #e2e8f0)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-primary, #0f172a)' }}>Intelligence Summary</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)' }}>
                <strong>Total:</strong> {caseIntel.length} items from {intelSources} sources
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border, #e2e8f0)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-primary, #0f172a)' }}>Timeline Summary</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)' }}>
                {tlRange ? (
                  <><strong>Range:</strong> {tlRange.start} to {tlRange.end} — {caseTl.length} events</>
                ) : (
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>No timeline events.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header">
          <h3 className="panel__title">Recent Reports</h3>
        </header>
        <div style={{ padding: '1.25rem', color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', textAlign: 'center' }}>
          No recent reports generated. Click "Generate Report" to create one.
        </div>
      </section>
    </div>
  )
}
