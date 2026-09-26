import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import NetworkGraph, { EntityPanel } from '../components/NetworkGraph'
import Modal from '../components/Modal'
import FormSection from '../components/forms/FormSection'
import FormField from '../components/forms/FormField'
import EntityChipList from '../components/entities/EntityChipList'

const ENTITY_TYPES = ['Person', 'Organization', 'Phone', 'Vehicle', 'Location', 'Bank Account', 'Digital Identifier', 'Contact', 'Other']
const ENTITY_ROLES = ['Suspect', 'Witness', 'Victim', 'Investigator/Official', 'Other']
const RELATIONSHIP_TYPES = ['Associated With', 'Uses', 'Communicates With', 'Owns', 'Located At', 'Works At', 'Transacted With', 'Linked To', 'Connected To']
const RISK_LEVELS = ['all', 'high', 'medium', 'low']
const TYPE_FILTER_OPTIONS = ['all', 'PERSON', 'ORGANIZATION', 'VEHICLE', 'LOCATION', 'CONTACT', 'OTHER', 'PHONE', 'BANK', 'EVIDENCE', 'CASE']
const INITIAL_NODE_COUNT = 5
const NODE_DISCLOSURE_STEPS = [5, 10, 20]
const RISK_PRIORITY = { CRITICAL: 60, HIGH: 42, MEDIUM: 24, LOW: 8 }
const ROLE_PRIORITY = { SUSPECT: 32, VICTIM: 24, WITNESS: 20, 'INVESTIGATOR/OFFICIAL': 12, CONTACT: 8 }
const STATUS_PRIORITY = { ACTIVE: 10, MONITORING: 8, DETAINED: 14, CLEARED: 1, INVESTIGATING: 12, ANALYZING: 12, COMPLETED: 0 }

const REL_TYPE_MAP = {
  'Associated With': 'ASSOCIATED_WITH',
  'Uses': 'USES',
  'Communicates With': 'COMMUNICATES_WITH',
  'Owns': 'OWNS',
  'Located At': 'LOCATED_AT',
  'Works At': 'WORKS_AT',
  'Transacted With': 'TRANSACTED_WITH',
  'Linked To': 'LINKED_TO',
  'Connected To': 'CONNECTED_TO',
}

const REL_DISPLAY = {
  ASSOCIATED_WITH: 'Associated With', USES: 'Uses', COMMUNICATES_WITH: 'Communicates With',
  OWNS: 'Owns', LOCATED_AT: 'Located At', WORKS_AT: 'Works At',
  TRANSACTED_WITH: 'Transacted With', LINKED_TO: 'Linked To', CONNECTED_TO: 'Connected To',
  CALLED: 'Called', TRANSFERRED_FUNDS_TO: 'Transferred Funds To', VISITED: 'Visited',
}

function confidenceColor(conf) {
  if (conf >= 80) return 'green'
  if (conf >= 60) return 'yellow'
  return 'orange'
}

function recencyScore(value) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 0
  const days = Math.max(0, (Date.now() - timestamp) / 86400000)
  return Math.max(0, 18 - days * 0.35)
}

function getNextNodeCount(currentCount, totalCount) {
  if (totalCount <= currentCount) return currentCount
  const nextStep = NODE_DISCLOSURE_STEPS.find((step) => step > currentCount)
  return Math.min(totalCount, nextStep || totalCount)
}

function graphPriority(entity, caseRelationships, focusId) {
  const related = caseRelationships.filter((relationship) => relationship.fromId === entity.id || relationship.toId === entity.id)
  const confidence = related.length
    ? related.reduce((total, relationship) => total + Number(relationship.confidence || (relationship.status === 'CONFIRMED' ? 85 : 55)), 0) / related.length
    : 0
  const role = ROLE_PRIORITY[String(entity.role || '').toUpperCase()] || 0
  const risk = RISK_PRIORITY[String(entity.risk || 'LOW').toUpperCase()] || 0
  const status = STATUS_PRIORITY[String(entity.status || 'ACTIVE').toUpperCase()] || 0
  return Math.round(
    role * 1.5
    + risk
    + status
    + related.length * 12
    + confidence * 0.35
    + recencyScore(entity.updatedAt || entity.createdAt)
    + (entity.id === focusId ? 100 : 0),
  )
}

function AddEntityModal({ open, onClose, onAdd, caseId }) {
  const [form, setForm] = useState({ name: '', type: 'Person', role: '', risk: 'LOW', description: '' })
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const entityData = { ...form, caseId }
    if (form.type !== 'Person') delete entityData.role
    onAdd(entityData)
    setForm({ name: '', type: 'Person', role: '', risk: 'LOW', description: '' })
    onClose()
  }
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title="Add Entity"
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="add-entity-form" className="btn btn--primary">Add Entity</button>
      </>}>
      <form id="add-entity-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormSection title="Entity Identity" subtitle="Classify the person, organization, asset, or location">
          <FormField label="Entity Name" required full>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. John Doe" required />
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Entity Type">
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value, role: e.target.value === 'Person' ? form.role : ''})}>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            {form.type === 'Person' && (
              <FormField label="Entity Role">
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="">Select role...</option>
                  {ENTITY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
            )}
          </div>
        </FormSection>
        <FormSection title="Risk & Context" subtitle="Set the initial assessment and investigative context">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Risk Level">
              <select value={form.risk} onChange={e => setForm({...form, risk: e.target.value})}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </FormField>
            <FormField label="Description" full>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="Brief description" />
            </FormField>
          </div>
        </FormSection>
      </form>
    </Modal>
  )
}

function AddRelationshipModal({ open, onClose, onAdd, caseId, entities }) {
  const [form, setForm] = useState({ fromId: '', toId: '', type: 'Associated With' })
  const caseEntities = entities.filter(e => e.caseId === caseId)
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.fromId || !form.toId) return
    onAdd({ fromId: form.fromId, toId: form.toId, type: REL_TYPE_MAP[form.type] || 'CONNECTED_TO', caseId })
    setForm({ fromId: '', toId: '', type: 'Associated With' })
    onClose()
  }
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title="Add Relationship"
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="add-rel-form" className="btn btn--primary">Add Relationship</button>
      </>}>
      <form id="add-rel-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormSection title="Relationship" subtitle="Connect two entities already mapped to this case">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="From Entity" required>
              <select value={form.fromId} onChange={e => setForm({...form, fromId: e.target.value, toId: e.target.value === form.toId ? '' : form.toId})} required>
                <option value="">Select entity...</option>
                {caseEntities.map(en => <option key={en.id} value={en.id}>{en.name} ({en.type})</option>)}
              </select>
            </FormField>
            <FormField label="Relationship Type">
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="To Entity" required>
              <select value={form.toId} onChange={e => setForm({...form, toId: e.target.value})} required>
                <option value="">Select entity...</option>
                {caseEntities.filter(en => en.id !== form.fromId).map(en => <option key={en.id} value={en.id}>{en.name} ({en.type})</option>)}
              </select>
            </FormField>
          </div>
        </FormSection>
      </form>
    </Modal>
  )
}

function SuggestionCard({ suggestion, onAccept, onReject, canEdit }) {
  const { id, fromName, toName, type, confidence, reason, status } = suggestion
  const confColor = confidenceColor(confidence)
  const relLabel = REL_DISPLAY[type] || type?.replace(/_/g, ' ') || 'Unknown'
  const isPending = status === 'PENDING'

  return (
    <div className={`suggestion-card suggestion-card--${isPending ? 'pending' : status?.toLowerCase()}`}>
      <div className="suggestion-card__header">
        <span className={`suggestion-card__status suggestion-card__status--${status?.toLowerCase()}`}>
          {status || 'PENDING'}
        </span>
        <span className={`suggestion-card__confidence suggestion-card__confidence--${confColor}`}>
          {confidence}%
        </span>
      </div>
      <div className="suggestion-card__relationship">
        <span className="suggestion-card__entity">{fromName}</span>
        <span className="suggestion-card__arrow">
          <Icon name="arrowRight" className="icon-xs" /> {relLabel}
        </span>
        <span className="suggestion-card__entity">{toName}</span>
      </div>
      {reason && <p className="suggestion-card__reason">{reason}</p>}
      {isPending && canEdit && (
        <div className="suggestion-card__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => onAccept(id)}>
            <Icon name="check" className="icon-xs" /> Accept
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onReject(id)}>
            <Icon name="close" className="icon-xs" /> Reject
          </button>
        </div>
      )}
    </div>
  )
}

export default function NetworkAnalysis() {
  const {
    user, cases, entities, relationships, aiSuggestions, analyzing, analysisStep,
    selectedCaseId: contextCaseId, addEntity, addRelationship, runAIAnalysis,
    acceptSuggestion, rejectSuggestion, addEntityModalOpen, setAddEntityModalOpen,
    addRelationshipModalOpen, setAddRelationshipModalOpen, selectedNetworkNode, setSelectedNetworkNode,
    networkFocusEntity, navigate, showToast, activeInvestigation,
  } = useApp()

  const [selectedCaseLocal, setSelectedCaseLocal] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [rotating, setRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [searchEntity, setSearchEntity] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(true)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const canvasRef = useRef(null)
  const [filters, setFilters] = useState({ type: 'all', risk: 'all' })
  const [visibleNodeCount, setVisibleNodeCount] = useState(INITIAL_NODE_COUNT)
  const prevCaseIdRef = useRef(null)
  const canEdit = user?.roleKey !== 'officer'

  const contextCase = useMemo(
    () => cases.find(c => c.id === contextCaseId) || null,
    [cases, contextCaseId]
  )

  useEffect(() => {
    const next = contextCase || (prevCaseIdRef.current === null ? cases[0] : null)
    if (!next) return
    const frame = window.requestAnimationFrame(() => {
      setSelectedCaseLocal(next)
      if (prevCaseIdRef.current !== next.id) {
        prevCaseIdRef.current = next.id
        setSearchEntity('')
        setFilters({ type: 'all', risk: 'all' })
        setVisibleNodeCount(INITIAL_NODE_COUNT)
        setSelectedNetworkNode(null)

      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [contextCase, cases, setSelectedNetworkNode])

  const caseEntities = useMemo(() =>
    selectedCaseLocal ? entities.filter(e => e.caseId === selectedCaseLocal.id) : [],
    [entities, selectedCaseLocal]
  )

  const caseRelationships = useMemo(() =>
    selectedCaseLocal
      ? relationships.filter(r => r.caseId === selectedCaseLocal.id && r.status !== 'REJECTED')
      : [],
    [relationships, selectedCaseLocal]
  )

  const caseSuggestions = useMemo(() =>
    selectedCaseLocal
      ? aiSuggestions.filter(s => s.caseId === selectedCaseLocal.id)
      : [],
    [aiSuggestions, selectedCaseLocal]
  )

  const pendingSuggestions = useMemo(() =>
    caseSuggestions.filter(s => s.status === 'PENDING'),
    [caseSuggestions]
  )

  const graphNodes = useMemo(() => caseEntities.map(e => ({
    id: e.id, label: e.name, type: e.type?.toUpperCase() || 'OTHER',
    risk: e.risk || 'LOW', entityId: e.id,
    priorityScore: graphPriority(e, caseRelationships, networkFocusEntity),
  })).sort((a, b) => b.priorityScore - a.priorityScore || String(b.label).localeCompare(String(a.label))), [caseEntities, caseRelationships, networkFocusEntity])

  useEffect(() => {
    if (!networkFocusEntity) return
    const frame = window.requestAnimationFrame(() => {
      const ent = caseEntities.find(e => e.id === networkFocusEntity)
      if (ent) {
        const rank = graphNodes.findIndex(node => node.id === ent.id)
        if (rank >= visibleNodeCount) setVisibleNodeCount(Math.min(graphNodes.length, rank + 1))
        setSelectedNetworkNode(ent.id)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [networkFocusEntity, caseEntities, graphNodes, visibleNodeCount, setSelectedNetworkNode])

  const graphEdges = useMemo(() => {
    const confirmed = caseRelationships.map(r => ({
      from: r.fromId, to: r.toId, type: r.type, label: r.label,
    }))
    if (showSuggestions) {
      const pendingEdges = pendingSuggestions.map(s => ({
        from: s.fromId, to: s.toId, type: s.type, label: `${s.confidence}%`,
        pending: true,
      }))
      return [...confirmed, ...pendingEdges]
    }
    return confirmed
  }, [caseRelationships, pendingSuggestions, showSuggestions])

  const selectedEntity = useMemo(() =>
    selectedNetworkNode ? caseEntities.find(e => e.id === selectedNetworkNode) : null,
    [selectedNetworkNode, caseEntities]
  )

  const clearFilters = () => { setFilters({ type: 'all', risk: 'all' }); setSearchEntity(''); setVisibleNodeCount(INITIAL_NODE_COUNT) }

  const handleNodeClick = (node) => { setSelectedNetworkNode(node.id) }

  const selectEntity = (entityId) => {
    const rank = graphNodes.findIndex((node) => node.id === entityId)
    if (rank >= visibleNodeCount) setVisibleNodeCount(Math.min(graphNodes.length, Math.max(INITIAL_NODE_COUNT, rank + 1)))
    setSelectedNetworkNode(entityId)
  }

  const handleEdgeClick = (edge) => {
    const relation = edge.type || edge.label || 'Relationship'
    const from = caseEntities.find((entity) => entity.id === edge.from)?.name || edge.from
    const to = caseEntities.find((entity) => entity.id === edge.to)?.name || edge.to
    showToast(`${from} ${String(relation).replace(/_/g, ' ').toLowerCase()} ${to}`, 'info')
  }

  const nextNodeCount = getNextNodeCount(visibleNodeCount, graphNodes.length)
  const showMoreNodes = () => setVisibleNodeCount(nextNodeCount)
  const resetNodeCount = () => setVisibleNodeCount(INITIAL_NODE_COUNT)

  const handleResetView = () => { setZoom(1); setPanX(0); setPanY(0); setRotating(false) }

  const handleFitToScreen = () => {
    if (graphNodes.length === 0) return
    setZoom(1); setPanX(0); setPanY(0)
  }

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX, panY }
  }, [panX, panY])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    setPanX(dragStart.current.panX + (e.clientX - dragStart.current.x))
    setPanY(dragStart.current.panY + (e.clientY - dragStart.current.y))
  }, [isDragging])

  const handleMouseUp = useCallback(() => { setIsDragging(false) }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setZoom(z => Math.min(Math.max(z + delta, 0.3), 3))
  }, [])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleRunAnalysis = () => {
    if (!selectedCaseLocal) return
    if (caseEntities.length < 2) {
      showToast('Need at least 2 entities to run analysis', 'error')
      return
    }
    runAIAnalysis(selectedCaseLocal.id)
  }

  const combinedFilters = { search: searchEntity, type: filters.type, risk: filters.risk }

  return (
    <div className="page-content network-workspace">
      {activeInvestigation && selectedCaseLocal && (
        <div className="investigation-banner">
          <span className="investigation-banner__label">Active Investigation</span>
          <span className="investigation-banner__name">{selectedCaseLocal.title}</span>
          <span className="investigation-banner__meta">{selectedCaseLocal.priority} · {selectedCaseLocal.type}</span>
        </div>
      )}

      <div className="network-context-bar">
        <div className="network-context-bar__left">
          <label className="form-field form-field--compact">
            <span>Investigation Case</span>
            <select value={selectedCaseLocal?.id || ''} onChange={(e) => {
              const c = cases.find(cs => cs.id === e.target.value)
              setSelectedCaseLocal(c || cases[0])
               setSelectedNetworkNode(null)
               setSearchEntity('')
               setFilters({ type: 'all', risk: 'all' })
               setVisibleNodeCount(INITIAL_NODE_COUNT)

            }}>
              {cases.map(c => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
            </select>
          </label>
        </div>
        <div className="network-context-bar__center">
          {selectedCaseLocal && <>
            <span className="network-context-bar__case-id">{selectedCaseLocal.id}</span>
            <span className="network-context-bar__case-title">{selectedCaseLocal.title}</span>
            <span className="network-context-bar__case-status">{selectedCaseLocal.status}</span>
          </>}
        </div>
        <div className="network-context-bar__right">
          <span>{caseEntities.length} entities</span>
          <span>{caseRelationships.length} relationships</span>
          {pendingSuggestions.length > 0 && (
            <span className="network-context-bar__ai-count">{pendingSuggestions.length} pending suggestions</span>
          )}
        </div>
      </div>

      <div className="network-workspace__layout">
        <aside className="network-controls">
          <h3 className="network-controls__title">Filters</h3>
          <label className="form-field form-field--compact">
            <span>Search Entity</span>
            <input type="text" value={searchEntity} onChange={e => setSearchEntity(e.target.value)} placeholder="Name, ID, or type..." />
          </label>
          <label className="form-field form-field--compact">
            <span>Entity Type</span>
            <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}>
              {TYPE_FILTER_OPTIONS.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>)}
            </select>
          </label>
          <label className="form-field form-field--compact">
            <span>Risk Level</span>
            <select value={filters.risk} onChange={e => setFilters({...filters, risk: e.target.value})}>
              {RISK_LEVELS.map(r => <option key={r} value={r}>{r === 'all' ? 'All Levels' : r.toUpperCase()}</option>)}
            </select>
          </label>
           <button type="button" className="btn btn--ghost btn--sm btn--full" onClick={clearFilters}>Clear Filters</button>

           <div className="network-discovery">
             <div className="network-discovery__heading">
               <span>Discovery view</span>
               <strong>{Math.min(visibleNodeCount, graphNodes.length)} / {graphNodes.length} nodes</strong>
             </div>
             <p>Highest-priority entities appear first. Expand as the investigation develops.</p>
             {graphNodes.length > visibleNodeCount ? (
               <button type="button" className="btn btn--accent btn--sm btn--full" onClick={showMoreNodes}>
                  <Icon name="plus" className="icon-xs" /> Show {nextNodeCount - visibleNodeCount} more

               </button>
             ) : graphNodes.length > INITIAL_NODE_COUNT ? (
               <button type="button" className="btn btn--ghost btn--sm btn--full" onClick={resetNodeCount}>Collapse to 5</button>
             ) : <span className="network-discovery__complete"><Icon name="check" className="icon-xs" /> All nodes visible</span>}
           </div>

           {caseEntities.length > 0 && (

            <div className="network-controls__entities">
              <h4>Case Entities</h4>
              <EntityChipList
                entities={caseEntities}
                maxVisible={5}
                title="Case Entities"
                 onSelect={(entity) => selectEntity(entity.id)}

              />
            </div>
          )}

          <div className="network-controls__divider" />

           {canEdit && <>
             <button type="button" className="btn btn--primary btn--sm btn--full" onClick={() => setAddEntityModalOpen(true)}>
               <Icon name="plus" className="icon-xs" /> Add Entity
             </button>
             <button type="button" className="btn btn--accent btn--sm btn--full" onClick={() => setAddRelationshipModalOpen(true)}
               disabled={caseEntities.length < 2} title={caseEntities.length < 2 ? 'Need at least 2 entities' : ''}>
               <Icon name="link" className="icon-xs" /> Add Relationship
             </button>
           </>}


          <div className="network-controls__divider" />

           {canEdit && <button type="button" className="btn btn--primary btn--sm btn--full"
             onClick={handleRunAnalysis}
             disabled={analyzing || caseEntities.length < 2}>
             {analyzing ? (
               <><Icon name="spinner" className="icon-xs" /> Analyzing...</>
             ) : (
               <><Icon name="zap" className="icon-xs" /> AI Analyze Case</>
             )}
           </button>}
           {canEdit && caseEntities.length < 2 && (
             <span className="network-controls__hint">Need at least 2 entities</span>
           )}


          <div className="network-controls__divider" />

          <label className="network-controls__toggle">
            <input type="checkbox" checked={showSuggestions} onChange={e => setShowSuggestions(e.target.checked)} />
            <span>Show AI suggestions on graph</span>
          </label>

          <div className="network-controls__divider" />

          <div className="network-controls__legend">
            <h4 className="network-controls__legend-title">Legend</h4>
            {[
              { type: 'PERSON', color: '#22d3ee' },
              { type: 'ORGANIZATION', color: '#a78bfa' },
              { type: 'PHONE', color: '#fbbf24' },
              { type: 'VEHICLE', color: '#94a3b8' },
              { type: 'LOCATION', color: '#4ade80' },
              { type: 'BANK', color: '#f87171' },
              { type: 'CONTACT', color: '#fbbf24' },
              { type: 'OTHER', color: '#94a3b8' },
            ].map(({ type, color }) => (
              <span key={type} className="legend-item">
                <span className="legend-dot" style={{ background: color }} /> {type}
              </span>
            ))}
            <span className="legend-item">
              <span className="legend-line legend-line--pending" /> PENDING SUGGESTION
            </span>
          </div>
        </aside>

        <div className="network-canvas" ref={canvasRef}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
          <div className="network-canvas__toolbar">
             <span className="network-canvas__info">{Math.min(visibleNodeCount, graphNodes.length)} of {graphNodes.length} nodes · {graphEdges.length} edges</span>

            <div className="network-canvas__zoom">
              <button type="button" className="topbar__icon-btn" onClick={() => setZoom(z => Math.min(z + 0.15, 3))}>
                <Icon name="zoomIn" className="icon-sm" />
              </button>
              <span className="network-canvas__zoom-level">{Math.round(zoom * 100)}%</span>
              <button type="button" className="topbar__icon-btn" onClick={() => setZoom(z => Math.max(z - 0.15, 0.3))}>
                <Icon name="zoomOut" className="icon-sm" />
              </button>
              <button type="button" className="topbar__icon-btn" onClick={handleResetView} title="Reset view">
                <Icon name="reset" className="icon-sm" />
              </button>
              <button type="button" className="topbar__icon-btn" onClick={handleFitToScreen} title="Fit to screen">
                <Icon name="maximize" className="icon-sm" />
              </button>
              <button type="button" className={`topbar__icon-btn ${rotating ? 'topbar__icon-btn--active' : ''}`}
                onClick={() => setRotating(r => !r)} title={rotating ? 'Stop rotation' : 'Start rotation'}>
                <Icon name="rotate" className="icon-sm" />
              </button>
            </div>
          </div>

          {caseEntities.length === 0 ? (
            <div className="network-empty-state">
              <Icon name="network" className="icon-lg" />
              <h3>No entities added yet</h3>
              <p>Add entities to begin building this case.</p>
               {canEdit && <div className="network-empty-state__actions">
                 <button type="button" className="btn btn--primary" onClick={() => setAddEntityModalOpen(true)}>
                   <Icon name="plus" className="icon-xs" /> Add Entity
                 </button>
               </div>}

            </div>
          ) : analyzing ? (
            <div className="network-empty-state">
              <Icon name="spinner" className="icon-lg network-empty-state__spinner" />
              <h3>AI Analysis in Progress</h3>
              <p className="network-empty-state__step">{analysisStep || 'Analyzing case...'}</p>
            </div>
          ) : (
            <NetworkGraph
              interactive selectedNodeId={selectedNetworkNode} onNodeClick={handleNodeClick}
              zoom={zoom} panX={panX} panY={panY} filters={combinedFilters}
               focusEntityId={networkFocusEntity} rotating={rotating}
               nodes={graphNodes} edges={graphEdges}
               nodeLimit={visibleNodeCount}
               onEdgeClick={handleEdgeClick}

            />
          )}
        </div>

        <EntityPanel
          nodeId={selectedNetworkNode}
          node={selectedEntity}
          relationships={caseRelationships}
          entities={caseEntities}
          onClose={() => setSelectedNetworkNode(null)}
          onViewProfile={() => { if (selectedEntity) navigate('suspects', { suspectId: selectedEntity.id }) }}
          onViewConnections={() => { if (selectedNetworkNode) {
            const rels = caseRelationships.filter(r => r.fromId === selectedNetworkNode || r.toId === selectedNetworkNode)
            showToast(`Found ${rels.length} direct connections`, 'info')
          }}}
          onAddToInvestigation={canEdit ? () => { if (selectedEntity) showToast(`${selectedEntity.name} added to active investigation`, 'success') } : undefined}
           onEntitySelect={(entity) => selectEntity(entity.id)}

        />
      </div>

      {caseEntities.length > 0 && !analyzing && (
        <div className="network-suggestions">
          <div className="network-suggestions__header">
            <h3 className="network-suggestions__title">
              <Icon name="zap" className="icon-sm" /> AI Suggestions
              {pendingSuggestions.length > 0 && (
                <span className="network-suggestions__badge">{pendingSuggestions.length} pending</span>
              )}
            </h3>
            <div className="network-suggestions__controls">
               {canEdit && <button type="button" className="btn btn--primary btn--sm" onClick={handleRunAnalysis} disabled={caseEntities.length < 2}>
                 <Icon name="zap" className="icon-xs" /> Re-run Analysis
               </button>}

            </div>
          </div>
          <div className="network-suggestions__body">
            {caseSuggestions.length === 0 ? (
              <div className="network-suggestions__empty">
                <Icon name="zap" className="icon-md" />
                {caseEntities.length < 2 ? (
                  <p>Your case has {caseEntities.length} {caseEntities.length === 1 ? 'entity' : 'entities'}. Add at least 2 entities to enable AI analysis.</p>
                ) : (
                  <p>No AI suggestions. Run AI Analysis to discover potential relationships.</p>
                )}
              </div>
            ) : (
              <div className="network-suggestions__list">
                {caseSuggestions.map(s => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    onAccept={acceptSuggestion}
                    onReject={rejectSuggestion}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {canEdit && <AddEntityModal open={addEntityModalOpen} onClose={() => setAddEntityModalOpen(false)} onAdd={addEntity} caseId={selectedCaseLocal?.id} />}
      {canEdit && <AddRelationshipModal open={addRelationshipModalOpen} onClose={() => setAddRelationshipModalOpen(false)} onAdd={addRelationship}
        caseId={selectedCaseLocal?.id} entities={entities} />}
    </div>
  )
}
