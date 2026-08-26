import { useState, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import RiskBadge from '../components/RiskBadge'
import Modal from '../components/Modal'
import {
  CASES,
  SUSPECTS,
  EVIDENCE,
  NETWORK_NODES,
  NETWORK_EDGES,
} from '../data/mockData'
import { exportReportPdf, downloadPdf } from '../utils/exportPdf'

function buildGeneratedReport(activeCase) {
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

  const relatedSuspects = SUSPECTS.filter((s) => activeCase.persons.includes(s.id))
  const relatedEvidence = EVIDENCE.filter((e) => e.case === activeCase.id)
  const relatedLocations = [...new Set(relatedSuspects.flatMap((s) => s.locations))]

  const relatedNodeIds = new Set()
  NETWORK_NODES.forEach((n) => {
    if (n.entityId && (activeCase.persons.includes(n.entityId) || activeCase.evidence.includes(n.entityId))) {
      relatedNodeIds.add(n.id)
    }
  })
  relatedSuspects.forEach((s) => {
    NETWORK_NODES.forEach((n) => {
      if (n.entityId === s.id) relatedNodeIds.add(n.id)
    })
  })

  const relatedEdges = NETWORK_EDGES.filter(([a, b]) => relatedNodeIds.has(a) || relatedNodeIds.has(b))
  const totalNodes = relatedNodeIds.size || activeCase.entities
  const totalEdges = relatedEdges.length || activeCase.entities - 1
  const avgConnections = totalNodes > 0 ? Math.round((totalEdges / totalNodes) * 10) / 10 : 0

  const highRiskSuspects = relatedSuspects.filter((s) => s.risk === 'HIGH')
  const criticalEvidence = relatedEvidence.filter((e) => e.confidence < 80)
  const avgConfidence = relatedEvidence.length > 0
    ? Math.round(relatedEvidence.reduce((s, e) => s + e.confidence, 0) / relatedEvidence.length)
    : 0

  const connections = []
  relatedEdges.forEach(([fromId, toId]) => {
    const a = NETWORK_NODES.find((n) => n.id === fromId)
    const b = NETWORK_NODES.find((n) => n.id === toId)
    if (a && b) connections.push(`${a.label} \u2194 ${b.label}`)
  })

  const allTimeline = activeCase.timeline ? [...activeCase.timeline] : []
  relatedSuspects.forEach((s) => {
    if (s.timeline) allTimeline.push(...s.timeline)
  })
  allTimeline.sort((a, b) => b.date.localeCompare(a.date))

  const findings = [
    `${activeCase.title} involves ${totalNodes} mapped entities across ${activeCase.persons.length} primary suspects.`,
    `${relatedSuspects.length} suspects directly linked: ${relatedSuspects.map((s) => s.name).join(', ') || 'None identified'}.`,
    `Network analysis reveals ${totalEdges} relationships across ${totalNodes} nodes with avg degree ${avgConnections}.`,
    `${relatedEvidence.length} evidence items collected with average confidence of ${avgConfidence}%.`,
    `${relatedLocations.length} operational locations identified: ${relatedLocations.join(', ') || 'None identified'}.`,
    highRiskSuspects.length > 0
      ? `${highRiskSuspects.length} high-risk suspect(s) require immediate attention: ${highRiskSuspects.map((s) => s.name).join(', ')}.`
      : 'No high-risk suspects currently identified.',
    criticalEvidence.length > 0
      ? `${criticalEvidence.length} evidence item(s) have confidence below 80% and require verification.`
      : 'All evidence items meet confidence thresholds.',
  ]

  const riskIndicators = []
  if (activeCase.risk === 'HIGH' || activeCase.risk === 'CRITICAL') {
    riskIndicators.push(`Case risk level is ${activeCase.risk} \u2014 elevated threat posture required.`)
  }
  relatedSuspects.forEach((s) => {
    if (s.risk === 'HIGH') {
      riskIndicators.push(`${s.name} (${s.alias || 'No alias'}) \u2014 risk score ${s.riskScore}/100, ${s.connections} connections, status: ${s.status}.`)
    }
  })
  riskIndicators.push(`${totalEdges} network relationships mapped. ${avgConnections} avg connections per node.`)
  if (criticalEvidence.length > 0) {
    riskIndicators.push(`${criticalEvidence.length} evidence items below confidence threshold \u2014 potential data integrity risk.`)
  }
  riskIndicators.push(`Active surveillance on ${relatedSuspects.filter((s) => s.status === 'Active Surveillance').length} suspects.`)

  const recommendations = [
    `Maintain active surveillance on all ${relatedSuspects.length} linked suspects, prioritizing high-risk individuals.`,
    'Request enhanced forensic analysis for evidence items with confidence below 80%.',
    'Expand network traversal to identify second-degree connections for newly identified nodes.',
    `Coordinate with international agencies for offshore account records linked to ${activeCase.title}.`,
    'Schedule weekly review meeting to assess investigation progress and risk posture.',
    'Prepare case file for judicial review \u2014 target completion within 14 days.',
  ]

  const investigationStatus = `The investigation into ${activeCase.title} is currently ${activeCase.status.toLowerCase()}. ${relatedSuspects.filter((s) => s.status === 'Active Surveillance').length} suspects remain under active surveillance. ${relatedEvidence.filter((e) => e.status === 'Verified').length} of ${relatedEvidence.length} evidence items have been verified.`

  const executiveSummary = activeCase.description + ` This comprehensive report consolidates findings from ${totalNodes} mapped entities, ${relatedSuspects.length} primary suspects, ${relatedEvidence.length} evidence items, and ${totalEdges} network relationships. The investigation remains ${activeCase.status.toLowerCase()} with ${activeCase.risk.toLowerCase()} risk posture.`

  const conclusion = `This comprehensive investigation report consolidates all intelligence gathered to date for ${activeCase.title}. The analysis reveals a structured criminal network with ${totalNodes} mapped entities and ${totalEdges} direct relationships. ${highRiskSuspects.length} high-risk suspects and ${criticalEvidence.length} evidence items requiring verification have been identified. Immediate action is recommended to advance the investigation and mitigate ongoing threats.`

  return {
    id: `RPT-GEN-${Date.now()}`,
    title: `${activeCase.title} \u2014 Comprehensive Investigation Report`,
    caseId: activeCase.id,
    caseTitle: activeCase.title,
    type: 'Comprehensive Investigation Report',
    status: 'Generated',
    priority: activeCase.priority,
    riskLevel: activeCase.risk,
    investigator: activeCase.leadInvestigator,
    generatedAt: timestamp,
    createdAt: timestamp,
    executiveSummary,
    summary: executiveSummary,
    investigationStatus,
    timeline: allTimeline,
    findings,
    suspects: relatedSuspects.map((s) => ({
      name: s.name,
      alias: s.alias,
      risk: s.risk,
      riskScore: s.riskScore,
      connections: s.connections,
      status: s.status,
      locations: s.locations,
      summary: s.summary,
    })),
    network: {
      totalNodes,
      totalEdges,
      avgConnections,
      findings: [
        `${totalNodes} entities identified in the criminal network.`,
        `${totalEdges} direct relationships mapped between entities.`,
        `${relatedSuspects.length > 0 ? relatedSuspects[0].name : 'Primary coordinator'} has the highest betweenness centrality \u2014 primary coordinator.`,
        `Network contains ${relatedSuspects.filter((n) => n.risk === 'HIGH').length} high-risk nodes.`,
        `Average degree centrality: ${avgConnections} connections per entity.`,
        'Cluster analysis reveals operational groups.',
      ],
    },
    locations: relatedLocations.map((loc) => ({
      name: loc,
      description: `Operational location linked to ${relatedSuspects.filter((s) => s.locations.includes(loc)).map((s) => s.name).join(', ')}.`,
    })),
    evidence: relatedEvidence.map((e) => ({
      id: e.id,
      description: e.description,
      confidence: e.confidence,
      status: e.status,
    })),
    connections,
    riskIndicators,
    recommendations,
    conclusion,
  }
}

export default function Reports() {
  const { showToast } = useApp()
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [viewingCase, setViewingCase] = useState(null)
  const [filterRisk, setFilterRisk] = useState('All')
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeSection, setActiveSection] = useState(null)
  const reportRef = useRef(null)

  const riskLevels = useMemo(() => ['All', ...new Set(CASES.map((c) => c.risk))], [])

  const filteredCases = useMemo(() => {
    return CASES.filter((c) => {
      if (filterRisk !== 'All' && c.risk !== filterRisk) return false
      return true
    })
  }, [filterRisk])

  const selectedCase = useMemo(() => {
    if (!selectedCaseId) return null
    return CASES.find((c) => c.id === selectedCaseId) || null
  }, [selectedCaseId])

  const closeReport = useCallback(() => {
    setSelectedReport(null)
    setActiveSection(null)
  }, [])

  const closeCaseDetail = useCallback(() => {
    setViewingCase(null)
  }, [])

  const handleGenerateForCase = useCallback((caseObj) => {
    if (!caseObj) {
      showToast('Select a case to generate its investigation report.', 'error')
      return
    }
    setGenerating(true)
    setViewingCase(null)
    setTimeout(() => {
      try {
        const report = buildGeneratedReport(caseObj)
        setSelectedReport(report)
        showToast(`Report generated for ${caseObj.title}`, 'success')
      } catch (err) {
        console.error('[NEXUS-CRIME] Report generation failed:', err)
        showToast('Failed to generate report. Please try again.', 'error')
      } finally {
        setGenerating(false)
      }
    }, 1200)
  }, [showToast])

  const handleGenerateFromHeader = useCallback(() => {
    handleGenerateForCase(selectedCase)
  }, [selectedCase, handleGenerateForCase])

  const handleRegenerate = useCallback(() => {
    if (!selectedReport) return
    const caseObj = CASES.find((c) => c.id === selectedReport.caseId)
    setSelectedReport(null)
    setTimeout(() => handleGenerateForCase(caseObj), 200)
  }, [selectedReport, handleGenerateForCase])

  const handleExportPdf = useCallback(
    (report) => {
      if (!report) {
        showToast('Generate the report before exporting it.', 'error')
        return
      }
      setExporting(true)
      setTimeout(() => {
        try {
          const doc = exportReportPdf(report)
          const filename = `NEXUS-CRIME-${report.caseId}-Investigation-Report.pdf`
          downloadPdf(doc, filename)
          showToast('PDF exported successfully', 'success')
        } catch (err) {
          console.error('[NEXUS-CRIME] PDF export failed:', err)
          showToast('Failed to export PDF. Check console for details.', 'error')
        } finally {
          setExporting(false)
        }
      }, 600)
    },
    [showToast],
  )

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const reportSections = selectedReport
    ? [
        { id: 'executive', label: 'Executive Summary', icon: 'shield' },
        { id: 'case', label: 'Case Overview', icon: 'folder' },
        { id: 'status', label: 'Investigation Status', icon: 'alert' },
        { id: 'timeline', label: 'Timeline', icon: 'rotate' },
        { id: 'persons', label: 'Key Persons', icon: 'users' },
        { id: 'network', label: 'Network Intel', icon: 'network' },
        { id: 'locations', label: 'Location Intel', icon: 'grid' },
        { id: 'evidence', label: 'Evidence', icon: 'shield' },
        { id: 'findings', label: 'Key Findings', icon: 'ai' },
        { id: 'risk', label: 'Risk Assessment', icon: 'alert' },
        { id: 'connections', label: 'Connections', icon: 'link' },
        { id: 'actions', label: 'Recommended Actions', icon: 'settings' },
        { id: 'conclusion', label: 'Conclusion', icon: 'maximize' },
      ]
    : []

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="page-header__desc">Generate and manage investigation reports</p>
        </div>
        <div className="page-header__actions">
          <select
            className="toolbar__select"
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
          >
            <option value="">Select Investigation Case</option>
            {CASES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} \u2014 {c.title}
              </option>
            ))}
          </select>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleGenerateFromHeader}
            disabled={generating || !selectedCaseId}
          >
            {generating ? (
              <span className="btn__spinner" />
            ) : (
              <Icon name="plus" className="icon-xs" />
            )}
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar__filters">
          {riskLevels.map((r) => (
            <button
              key={r}
              className={`category-tab ${filterRisk === r ? 'category-tab--active' : ''}`}
              onClick={() => setFilterRisk(r)}
            >
              {r === 'All' ? 'All Risk Levels' : r}
            </button>
          ))}
        </div>
      </div>

      <div className="data-table-wrap panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Case ID</th>
              <th>Lead Investigator</th>
              <th>Entities</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.map((c) => (
              <tr key={c.id} className={selectedCaseId === c.id ? 'data-table__row--highlighted' : ''}>
                <td>
                  <div className="report-title-cell">
                    <span className="report-title-cell__name">{c.title}</span>
                    <span className="report-title-cell__id">{c.description}</span>
                  </div>
                </td>
                <td><span className="mono">{c.id}</span></td>
                <td>{c.leadInvestigator}</td>
                <td><span className="mono">{c.entities}</span></td>
                <td><RiskBadge level={c.risk} /></td>
                <td>
                  <span className={`status-chip status-chip--${c.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {c.status}
                  </span>
                </td>
                <td>{c.lastUpdated}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => setViewingCase(c)}>
                      <Icon name="maximize" className="icon-xs" />
                      View
                    </button>
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() => {
                        setSelectedCaseId(c.id)
                        handleGenerateForCase(c)
                      }}
                      disabled={generating}
                    >
                      {generating ? <span className="btn__spinner" /> : <Icon name="plus" className="icon-xs" />}
                      Generate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Case Detail Modal */}
      <Modal
        open={!!viewingCase}
        onClose={closeCaseDetail}
        title={viewingCase ? `${viewingCase.title} \u2014 Case Details` : ''}
        size="xl"
      >
        {viewingCase && (
          <div className="report-document">
            <div className="report-document__body" style={{ maxHeight: '65vh' }}>
              <div className="report-document__header">
                <div className="report-document__header-brand">NEXUS-CRIME</div>
                <div className="report-document__header-subtitle">Case Intelligence Summary</div>
                <div className="report-document__header-rule" />
                <h2 className="report-document__header-title">{viewingCase.title}</h2>
                <div className="report-document__header-meta">
                  <span className="mono">{viewingCase.id}</span>
                  <span className="report-document__header-sep">\u00b7</span>
                  <span>{viewingCase.leadInvestigator}</span>
                  <span className="report-document__header-sep">\u00b7</span>
                  <span>{viewingCase.lastUpdated}</span>
                </div>
              </div>

              <div className="report-document__kpis">
                <div className="report-document__kpi">
                  <span className="report-document__kpi-value">{viewingCase.entities}</span>
                  <span className="report-document__kpi-label">Entities</span>
                </div>
                <div className="report-document__kpi">
                  <span className="report-document__kpi-value">{viewingCase.persons.length}</span>
                  <span className="report-document__kpi-label">Suspects</span>
                </div>
                <div className="report-document__kpi">
                  <span className="report-document__kpi-value">{viewingCase.evidence.length}</span>
                  <span className="report-document__kpi-label">Evidence</span>
                </div>
                <div className="report-document__kpi">
                  <span className="report-document__kpi-value report-document__kpi-value--risk">{viewingCase.risk}</span>
                  <span className="report-document__kpi-label">Risk Level</span>
                </div>
              </div>

              <section className="report-document__section">
                <h3>Case Overview</h3>
                <div className="report-document__kv-grid">
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Case ID</span>
                    <span className="report-document__kv-val mono">{viewingCase.id}</span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Priority</span>
                    <span className="report-document__kv-val"><RiskBadge level={viewingCase.priority} /></span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Status</span>
                    <span className={`status-chip status-chip--${viewingCase.status.toLowerCase().replace(/\s+/g, '-')}`}>{viewingCase.status}</span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Lead Investigator</span>
                    <span className="report-document__kv-val">{viewingCase.leadInvestigator}</span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Entities Mapped</span>
                    <span className="report-document__kv-val">{viewingCase.entities}</span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Last Updated</span>
                    <span className="report-document__kv-val">{viewingCase.lastUpdated}</span>
                  </div>
                </div>
              </section>

              <section className="report-document__section">
                <h3>Description</h3>
                <p className="report-document__text">{viewingCase.description}</p>
              </section>

              {viewingCase.timeline && viewingCase.timeline.length > 0 && (
                <section className="report-document__section">
                  <h3>Timeline</h3>
                  <div className="report-document__timeline">
                    {viewingCase.timeline.map((item, i) => (
                      <div key={i} className="report-document__timeline-item">
                        <div className="report-document__timeline-dot" />
                        <div className="report-document__timeline-content">
                          <span className="report-document__timeline-date">{item.date}</span>
                          <span className="report-document__timeline-event">{item.event}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {viewingCase.persons.length > 0 && (
                <section className="report-document__section">
                  <h3>Linked Persons</h3>
                  <div className="report-document__connections">
                    {viewingCase.persons.map((pid) => {
                      const person = SUSPECTS.find((s) => s.id === pid)
                      return (
                        <span key={pid} className="report-document__connection-tag">
                          {person ? `${person.name}${person.alias ? ` (${person.alias})` : ''}` : pid}
                          {person && <RiskBadge level={person.risk} />}
                        </span>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>

            <div className="report-document__footer-actions no-print">
              <button className="btn btn--ghost" onClick={closeCaseDetail}>Close</button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  setSelectedCaseId(viewingCase.id)
                  handleGenerateForCase(viewingCase)
                }}
                disabled={generating}
              >
                {generating ? <span className="btn__spinner" /> : <Icon name="plus" className="icon-xs" />}
                {generating ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Full Report Modal */}
      <Modal
        open={!!selectedReport}
        onClose={closeReport}
        title={selectedReport?.title || ''}
        size="xl"
      >
        {selectedReport && (
          <div className="report-document" ref={reportRef}>
            <div className="report-document__toolbar no-print">
              <div className="report-document__toolbar-left">
                <span className={`status-chip status-chip--${selectedReport.status.toLowerCase()}`}>
                  {selectedReport.status}
                </span>
                <span className="report-document__toolbar-meta">
                  {selectedReport.generatedAt || selectedReport.createdAt}
                </span>
              </div>
              <div className="report-document__toolbar-right">
                <button className="btn btn--ghost btn--sm" onClick={handleRegenerate} disabled={generating}>
                  <Icon name="rotate" className="icon-xs" />
                  Regenerate
                </button>
                <button className="btn btn--ghost btn--sm" onClick={handlePrint}>
                  Print
                </button>
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => handleExportPdf(selectedReport)}
                  disabled={exporting}
                >
                  {exporting ? (
                    <span className="btn__spinner" />
                  ) : (
                    <Icon name="maximize" className="icon-xs" />
                  )}
                  {exporting ? 'Generating PDF...' : 'Export PDF'}
                </button>
              </div>
            </div>

            <div className="report-document__nav no-print">
              {reportSections.map((sec) => (
                <button
                  key={sec.id}
                  className={`report-document__nav-item ${activeSection === sec.id ? 'report-document__nav-item--active' : ''}`}
                  onClick={() => {
                    setActiveSection(sec.id)
                    document.getElementById(`rpt-section-${sec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <Icon name={sec.icon} className="icon-xs" />
                  {sec.label}
                </button>
              ))}
            </div>

            <div className="report-document__body">
              <div className="report-document__header">
                <div className="report-document__header-brand">NEXUS-CRIME</div>
                <div className="report-document__header-subtitle">Investigation Intelligence Report</div>
                <div className="report-document__header-rule" />
                <h2 className="report-document__header-title">{selectedReport.title}</h2>
                <div className="report-document__header-meta">
                  <span>{selectedReport.type}</span>
                  <span className="report-document__header-sep">\u00b7</span>
                  <span className="mono">{selectedReport.caseId}</span>
                  <span className="report-document__header-sep">\u00b7</span>
                  <span>{selectedReport.investigator}</span>
                  <span className="report-document__header-sep">\u00b7</span>
                  <span>{selectedReport.generatedAt}</span>
                </div>
              </div>

              <div className="report-document__kpis">
                <div className="report-document__kpi">
                  <span className="report-document__kpi-value">{selectedReport.network?.totalNodes || 0}</span>
                  <span className="report-document__kpi-label">Entities</span>
                </div>
                <div className="report-document__kpi">
                  <span className="report-document__kpi-value">{selectedReport.network?.totalEdges || 0}</span>
                  <span className="report-document__kpi-label">Connections</span>
                </div>
                <div className="report-document__kpi">
                  <span className="report-document__kpi-value">{selectedReport.suspects?.length || 0}</span>
                  <span className="report-document__kpi-label">Suspects</span>
                </div>
                <div className="report-document__kpi">
                  <span className="report-document__kpi-value">{selectedReport.evidence?.length || 0}</span>
                  <span className="report-document__kpi-label">Evidence</span>
                </div>
                <div className="report-document__kpi">
                  <span className="report-document__kpi-value report-document__kpi-value--risk">{selectedReport.riskLevel || selectedReport.priority}</span>
                  <span className="report-document__kpi-label">Risk Level</span>
                </div>
              </div>

              <section id="rpt-section-executive" className="report-document__section">
                <h3>1. Executive Summary</h3>
                <p className="report-document__text">{selectedReport.executiveSummary}</p>
              </section>

              <section id="rpt-section-case" className="report-document__section">
                <h3>2. Case Overview</h3>
                <div className="report-document__kv-grid">
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Case ID</span>
                    <span className="report-document__kv-val mono">{selectedReport.caseId}</span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Case Title</span>
                    <span className="report-document__kv-val">{selectedReport.caseTitle}</span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Priority</span>
                    <span className="report-document__kv-val"><RiskBadge level={selectedReport.priority} /></span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Status</span>
                    <span className={`status-chip status-chip--${selectedReport.status.toLowerCase()}`}>{selectedReport.status}</span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Lead Investigator</span>
                    <span className="report-document__kv-val">{selectedReport.investigator}</span>
                  </div>
                  <div className="report-document__kv">
                    <span className="report-document__kv-key">Risk Level</span>
                    <span className="report-document__kv-val"><RiskBadge level={selectedReport.riskLevel || selectedReport.priority} /></span>
                  </div>
                </div>
              </section>

              <section id="rpt-section-status" className="report-document__section">
                <h3>3. Investigation Status</h3>
                <p className="report-document__text">{selectedReport.investigationStatus}</p>
              </section>

              {selectedReport.timeline && selectedReport.timeline.length > 0 && (
                <section id="rpt-section-timeline" className="report-document__section">
                  <h3>4. Investigation Timeline</h3>
                  <div className="report-document__timeline">
                    {selectedReport.timeline.map((item, i) => (
                      <div key={i} className="report-document__timeline-item">
                        <div className="report-document__timeline-dot" />
                        <div className="report-document__timeline-content">
                          <span className="report-document__timeline-date">{item.date}</span>
                          <span className="report-document__timeline-event">{item.event}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section id="rpt-section-persons" className="report-document__section">
                <h3>5. Key Persons of Interest</h3>
                {selectedReport.suspects && selectedReport.suspects.length > 0 ? (
                  <div className="report-document__suspects">
                    {selectedReport.suspects.map((s, i) => (
                      <div key={i} className="report-document__suspect-card">
                        <div className="report-document__suspect-header">
                          <div className="report-document__suspect-identity">
                            <span className="report-document__suspect-name">
                              {s.name}{s.alias ? <span className="report-document__suspect-alias"> ({s.alias})</span> : ''}
                            </span>
                            <RiskBadge level={s.risk} />
                          </div>
                          <div className="report-document__suspect-metrics">
                            <div className="report-document__suspect-metric">
                              <span className="report-document__suspect-metric-val">{s.riskScore}</span>
                              <span className="report-document__suspect-metric-label">Risk Score</span>
                            </div>
                            <div className="report-document__suspect-metric">
                              <span className="report-document__suspect-metric-val">{s.connections}</span>
                              <span className="report-document__suspect-metric-label">Connections</span>
                            </div>
                          </div>
                        </div>
                        <div className="report-document__suspect-details">
                          <span className="report-document__suspect-detail"><strong>Status:</strong> {s.status}</span>
                          <span className="report-document__suspect-detail"><strong>Locations:</strong> {s.locations.join(', ')}</span>
                        </div>
                        <p className="report-document__suspect-summary">{s.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="report-document__muted">No suspects identified.</p>
                )}
              </section>

              <section id="rpt-section-network" className="report-document__section">
                <h3>6. Network Intelligence</h3>
                <div className="report-document__network-kpis">
                  <div className="report-document__network-kpi">
                    <span className="report-document__network-kpi-val">{selectedReport.network.totalNodes}</span>
                    <span className="report-document__network-kpi-label">Nodes</span>
                  </div>
                  <div className="report-document__network-kpi">
                    <span className="report-document__network-kpi-val">{selectedReport.network.totalEdges}</span>
                    <span className="report-document__network-kpi-label">Edges</span>
                  </div>
                  <div className="report-document__network-kpi">
                    <span className="report-document__network-kpi-val">{selectedReport.network.avgConnections}</span>
                    <span className="report-document__network-kpi-label">Avg Degree</span>
                  </div>
                </div>
                <ul className="report-document__findings-list">
                  {selectedReport.network.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </section>

              <section id="rpt-section-locations" className="report-document__section">
                <h3>7. Location Intelligence</h3>
                {selectedReport.locations && selectedReport.locations.length > 0 ? (
                  <ul className="report-document__findings-list">
                    {selectedReport.locations.map((loc, i) => (
                      <li key={i}>
                        <strong>{loc.name}</strong> \u2014 {loc.description}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="report-document__muted">No locations identified.</p>
                )}
              </section>

              <section id="rpt-section-evidence" className="report-document__section">
                <h3>8. Evidence Summary</h3>
                {selectedReport.evidence && selectedReport.evidence.length > 0 ? (
                  <div className="report-document__evidence-grid">
                    {selectedReport.evidence.map((e, i) => (
                      <div key={i} className="report-document__evidence-card">
                        <div className="report-document__evidence-header">
                          <span className="report-document__evidence-id mono">{e.id}</span>
                          <span className={`report-document__evidence-status report-document__evidence-status--${e.status.toLowerCase()}`}>{e.status}</span>
                        </div>
                        <p className="report-document__evidence-desc">{e.description}</p>
                        <div className="report-document__evidence-confidence">
                          <div className="report-document__evidence-bar">
                            <div className="report-document__evidence-bar-fill" style={{ width: `${e.confidence}%` }} />
                          </div>
                          <span className="report-document__evidence-pct">{e.confidence}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="report-document__muted">No evidence items linked.</p>
                )}
              </section>

              <section id="rpt-section-findings" className="report-document__section">
                <h3>9. Key Findings</h3>
                <ol className="report-document__numbered-list">
                  {selectedReport.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ol>
              </section>

              <section id="rpt-section-risk" className="report-document__section">
                <h3>10. Risk Assessment</h3>
                <ul className="report-document__findings-list">
                  {selectedReport.riskIndicators.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </section>

              <section id="rpt-section-connections" className="report-document__section">
                <h3>11. Connections &amp; Links</h3>
                {selectedReport.connections && selectedReport.connections.length > 0 ? (
                  <div className="report-document__connections">
                    {selectedReport.connections.map((c, i) => (
                      <span key={i} className="report-document__connection-tag">{c}</span>
                    ))}
                  </div>
                ) : (
                  <p className="report-document__text">{selectedReport.network.totalEdges} direct entity-to-entity relationships mapped in the network graph.</p>
                )}
              </section>

              <section id="rpt-section-actions" className="report-document__section">
                <h3>12. Recommended Actions</h3>
                <ol className="report-document__numbered-list">
                  {selectedReport.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ol>
              </section>

              <section id="rpt-section-conclusion" className="report-document__section">
                <h3>13. Conclusion</h3>
                <p className="report-document__text">{selectedReport.conclusion}</p>
              </section>

              <div className="report-document__classification">
                CLASSIFICATION: CONFIDENTIAL \u2014 LAW ENFORCEMENT SENSITIVE
              </div>
            </div>

            <div className="report-document__footer-actions no-print">
              <button className="btn btn--ghost" onClick={closeReport}>Close</button>
              <button className="btn btn--ghost" onClick={handlePrint}>Print</button>
              <button className="btn btn--secondary" onClick={handleRegenerate} disabled={generating}>
                Regenerate
              </button>
              <button
                className="btn btn--primary"
                onClick={() => handleExportPdf(selectedReport)}
                disabled={exporting}
              >
                {exporting ? <span className="btn__spinner" /> : <Icon name="maximize" className="icon-xs" />}
                {exporting ? 'Generating PDF...' : 'Export PDF'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
