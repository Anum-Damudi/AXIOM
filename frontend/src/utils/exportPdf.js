import { jsPDF } from 'jspdf'

const ACCENT = [8, 145, 178]
const DARK_HEADER = [15, 23, 42]
const CARD_BG = [240, 253, 250]
const CARD_BORDER = [153, 246, 228]
const TEXT_PRIMARY = [15, 23, 42]
const TEXT_SECONDARY = [51, 65, 85]
const TEXT_MUTED = [100, 116, 139]
const BORDER = [226, 232, 240]
const RISK_HIGH = [220, 38, 38]
const RISK_MEDIUM = [217, 119, 6]
const RISK_LOW = [22, 163, 74]

function riskColor(level) {
  if (level === 'HIGH' || level === 'CRITICAL') return RISK_HIGH
  if (level === 'MEDIUM') return RISK_MEDIUM
  return RISK_LOW
}

function riskLabel(level) {
  if (level === 'HIGH' || level === 'CRITICAL') return 'CRIT'
  if (level === 'MEDIUM') return 'MED'
  return 'LOW'
}

export function exportReportPdf(report) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 22
  const contentW = pageW - margin * 2
  let y = margin

  function checkPage(needed) {
    if (y + needed > pageH - 16) {
      doc.addPage()
      y = margin
      return true
    }
    return false
  }

  function addLine(color = BORDER, thickness = 0.3) {
    doc.setDrawColor(...color)
    doc.setLineWidth(thickness)
    doc.line(margin, y, pageW - margin, y)
    y += 2.5
  }

  function addText(text, fontSize, color = TEXT_SECONDARY, options = {}) {
    const { bold = false, maxWidth = contentW, align = 'left', lineHeight = 1.7 } = options
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(fontSize)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, maxWidth)
    const lineH = fontSize * 0.45 * lineHeight
    checkPage(lines.length * lineH + 3)
    if (align === 'center') {
      doc.text(lines, pageW / 2, y, { align: 'center' })
    } else {
      doc.text(lines, margin, y)
    }
    y += lines.length * lineH + 2
  }

  function addKeyValue(key, value, keyColor = TEXT_MUTED, valueColor = TEXT_PRIMARY) {
    checkPage(6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...keyColor)
    doc.text(key, margin, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...valueColor)
    doc.text(String(value), margin + 46, y)
    y += 5.5
  }

  function addBullet(text, indent = 0) {
    checkPage(6)
    const x = margin + indent
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_SECONDARY)
    doc.text('\u2022', x, y)
    const lines = doc.splitTextToSize(text, contentW - indent - 7)
    doc.text(lines, x + 5, y)
    y += lines.length * 4 + 2
  }

  function addNumberedItem(num, text) {
    checkPage(6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ACCENT)
    doc.text(`${num}.`, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT_SECONDARY)
    const lines = doc.splitTextToSize(text, contentW - 10)
    doc.text(lines, margin + 8, y)
    y += lines.length * 4 + 2.5
  }

  function addSectionTitle(title) {
    checkPage(14)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...ACCENT)
    doc.text(title.toUpperCase(), margin, y)
    y += 2
    addLine(ACCENT, 0.5)
    y += 3
  }

  function addSubTitle(title) {
    checkPage(7)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...TEXT_PRIMARY)
    doc.text(title, margin, y)
    y += 5
  }

  function addKPIRow(items) {
    const gap = 4
    const kpiW = (contentW - gap * (items.length - 1)) / items.length
    checkPage(18)
    items.forEach((item, i) => {
      const x = margin + i * (kpiW + gap)
      doc.setFillColor(...CARD_BG)
      doc.roundedRect(x, y, kpiW, 14, 2, 2, 'F')
      doc.setDrawColor(...CARD_BORDER)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, y, kpiW, 14, 2, 2, 'S')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(...ACCENT)
      doc.text(String(item.value), x + kpiW / 2, y + 7.5, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...TEXT_MUTED)
      doc.text(item.label.toUpperCase(), x + kpiW / 2, y + 12, { align: 'center' })
    })
    y += 18
  }

  // ── Cover Header ──────────────────────────────────────
  doc.setFillColor(...DARK_HEADER)
  doc.rect(0, 0, pageW, 50, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...ACCENT)
  doc.text('NEXUS-CRIME', margin, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text('CRIMINAL INTELLIGENCE PLATFORM', margin, 21)

  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(margin, 24, pageW - margin, 24)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Investigation Intelligence Report', margin, 29)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(241, 245, 249)
  const titleLines = doc.splitTextToSize(report.title, contentW)
  doc.text(titleLines, margin, 37)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated: ${report.generatedAt}  |  Case: ${report.caseId}  |  Classification: CONFIDENTIAL`, margin, 46)

  y = 50 + 8

  // ── 1. Executive Summary ──────────────────────────────
  addSectionTitle('1. Executive Summary')
  addText(report.executiveSummary || report.summary, 9.5, TEXT_SECONDARY)

  // ── KPI Row ──────────────────────────────
  const kpis = [
    { value: report.network.totalNodes, label: 'Entities' },
    { value: report.network.totalEdges, label: 'Connections' },
    { value: report.suspects.length, label: 'Suspects' },
    { value: report.evidence.length, label: 'Evidence' },
  ]
  addKPIRow(kpis)

  // ── 2. Case Overview ──────────────────────────────
  addSectionTitle('2. Case Overview')
  addKeyValue('Case ID:', report.caseId)
  addKeyValue('Case Title:', report.caseTitle)
  addKeyValue('Priority:', report.priority)
  addKeyValue('Status:', report.status)
  addKeyValue('Lead Investigator:', report.investigator)
  addKeyValue('Risk Level:', report.riskLevel || report.priority)
  y += 3

  // ── 3. Investigation Status ──────────────────────────────
  addSectionTitle('3. Investigation Status')
  addText(report.investigationStatus || 'The investigation is currently active with ongoing intelligence gathering and analysis operations.', 9.5, TEXT_SECONDARY)

  // ── 4. Timeline ──────────────────────────────
  addSectionTitle('4. Investigation Timeline')
  if (report.timeline && report.timeline.length > 0) {
    report.timeline.forEach((item) => {
      checkPage(7)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...ACCENT)
      doc.text(item.date, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...TEXT_SECONDARY)
      const lines = doc.splitTextToSize(item.event, contentW - 32)
      doc.text(lines, margin + 28, y)
      y += lines.length * 4 + 3
    })
  } else {
    addText('No timeline events available.', 9, TEXT_MUTED)
  }
  y += 3

  // ── 5. Key Persons of Interest ──────────────────────────────
  addSectionTitle('5. Key Persons of Interest')
  if (report.suspects.length === 0) {
    addText('No persons of interest identified.', 9, TEXT_MUTED)
  } else {
    report.suspects.forEach((s) => {
      checkPage(22)
      const nameStr = `${s.name}${s.alias ? ` (${s.alias})` : ''}`
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...TEXT_PRIMARY)
      doc.text(nameStr, margin, y)

      const rc = riskColor(s.risk)
      const nameW = doc.getTextWidth(nameStr)
      doc.setFillColor(...rc)
      doc.roundedRect(margin + nameW + 3, y - 3.8, 14, 5.5, 1.5, 1.5, 'F')
      doc.setFontSize(6.5)
      doc.setTextColor(255, 255, 255)
      doc.text(riskLabel(s.risk), margin + nameW + 6.5, y - 0.5)
      y += 6
      addKeyValue('Risk Score:', `${s.riskScore}/100`)
      addKeyValue('Connections:', String(s.connections))
      addKeyValue('Status:', s.status)
      addKeyValue('Locations:', s.locations.join(', '))
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...TEXT_SECONDARY)
      const sumLines = doc.splitTextToSize(s.summary, contentW - 4)
      checkPage(sumLines.length * 3.8 + 1)
      doc.text(sumLines, margin, y)
      y += sumLines.length * 3.8 + 4
    })
  }

  // ── 6. Network Intelligence ──────────────────────────────
  addSectionTitle('6. Network Intelligence')
  addSubTitle('Network Statistics')
  addKPIRow([
    { value: report.network.totalNodes, label: 'Nodes' },
    { value: report.network.totalEdges, label: 'Edges' },
    { value: report.network.avgConnections, label: 'Avg Deg' },
  ])
  addSubTitle('Key Network Findings')
  report.network.findings.forEach((f) => addBullet(f))
  y += 3

  // ── 7. Location Intelligence ──────────────────────────────
  addSectionTitle('7. Location Intelligence')
  if (report.locations.length === 0) {
    addText('No locations identified.', 9, TEXT_MUTED)
  } else {
    report.locations.forEach((loc) => {
      checkPage(7)
      addBullet(`${loc.name} \u2014 ${loc.description}`)
    })
  }
  y += 3

  // ── 8. Evidence Summary ──────────────────────────────
  addSectionTitle('8. Evidence Summary')
  if (report.evidence.length === 0) {
    addText('No evidence items linked.', 9, TEXT_MUTED)
  } else {
    report.evidence.forEach((e) => {
      checkPage(7)
      addBullet(`${e.id}: ${e.description} (Confidence: ${e.confidence}%, Status: ${e.status})`)
    })
  }
  y += 3

  // ── 9. Key Findings ──────────────────────────────
  addSectionTitle('9. Key Findings')
  report.findings.forEach((f, i) => addNumberedItem(i + 1, f))
  y += 3

  // ── 10. Risk Assessment ──────────────────────────────
  addSectionTitle('10. Risk Assessment')
  report.riskIndicators.forEach((r) => addBullet(r))
  y += 3

  // ── 11. Connections & Links ──────────────────────────────
  addSectionTitle('11. Connections & Links')
  const connections = report.connections || []
  if (connections.length === 0) {
    addText(`${report.network.totalEdges} direct entity-to-entity relationships mapped in the network graph.`, 9, TEXT_SECONDARY)
  } else {
    connections.forEach((c) => addBullet(c))
  }
  y += 3

  // ── 12. Recommended Actions ──────────────────────────────
  addSectionTitle('12. Recommended Actions')
  report.recommendations.forEach((r, i) => addNumberedItem(i + 1, r))
  y += 4

  // ── 13. Conclusion ──────────────────────────────
  addSectionTitle('13. Conclusion')
  addText(report.conclusion || `This comprehensive investigation report consolidates all intelligence gathered to date for ${report.caseTitle}. The analysis reveals a structured criminal network with ${report.network.totalNodes} mapped entities and ${report.network.totalEdges} direct relationships. Immediate action is recommended on ${report.suspects.filter((s) => s.risk === 'HIGH').length} high-risk suspects and ${report.evidence.filter((e) => e.confidence < 80).length} evidence items requiring verification.`, 9.5, TEXT_SECONDARY)
  y += 6

  // ── Classification Footer ──────────────────────────────
  checkPage(14)
  doc.setFillColor(...CARD_BG)
  doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F')
  doc.setDrawColor(...CARD_BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, contentW, 10, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...ACCENT)
  doc.text('CLASSIFICATION: CONFIDENTIAL \u2014 LAW ENFORCEMENT SENSITIVE', margin + 4, y + 6.5)
  y += 14

  // ── Page Footer ──────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(...DARK_HEADER)
    doc.rect(0, pageH - 12, pageW, 12, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('NEXUS-CRIME \u2014 Confidential Investigation Report', margin, pageH - 5)
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 5, { align: 'right' })
    doc.text(report.generatedAt, pageW / 2, pageH - 5, { align: 'center' })
  }

  return doc
}

export function downloadPdf(doc, filename) {
  doc.save(filename)
}
