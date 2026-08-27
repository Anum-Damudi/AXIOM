import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import NetworkGraph, { EntityPanel } from '../components/NetworkGraph'
import Modal from '../components/Modal'

const ENTITY_TYPES = ['Person', 'Organization', 'Phone', 'Vehicle', 'Location', 'Bank Account', 'Digital Identifier', 'Contact', 'Other']
const ENTITY_ROLES = ['Suspect', 'Witness', 'Victim', 'Investigator/Official', 'Other']
const RELATIONSHIP_TYPES = ['Associated With', 'Uses', 'Communicates With', 'Owns', 'Located At', 'Works At', 'Transacted With', 'Linked To', 'Connected To']
const RISK_LEVELS = ['all', 'high', 'medium', 'low']
const TYPE_FILTER_OPTIONS = ['all', 'PERSON', 'ORGANIZATION', 'VEHICLE', 'LOCATION', 'CONTACT', 'OTHER', 'PHONE', 'BANK', 'EVIDENCE', 'CASE']

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
      <form id="add-entity-form" className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Entity Name</span>
          <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. John Doe" required />
        </label>
        <label className="form-field">
          <span>Entity Type</span>
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value, role: e.target.type === 'Person' ? form.role : ''})}>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {form.type === 'Person' && (
          <label className="form-field">
            <span>Entity Role</span>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="">Select role...</option>
              {ENTITY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
        <label className="form-field">
          <span>Risk Level</span>
          <select value={form.risk} onChange={e => setForm({...form, risk: e.target.value})}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </label>
        <label className="form-field">
          <span>Description</span>
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="Brief description" />
        </label>
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
      <form id="add-rel-form" className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>From Entity</span>
          <select value={form.fromId} onChange={e => setForm({...form, fromId: e.target.value})} required>
            <option value="">Select entity...</option>
            {caseEntities.map(en => <option key={en.id} value={en.id}>{en.name} ({en.type})</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Relationship Type</span>
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>To Entity</span>
          <select value={form.toId} onChange={e => setForm({...form, toId: e.target.value})} required>
            <option value="">Select entity...</option>
            {caseEntities.filter(en => en.id !== form.fromId).map(en => <option key={en.id} value={en.id}>{en.name} ({en.type})</option>)}
          </select>
        </label>
      </form>
    </Modal>
  )
}

function SuggestionCard({ suggestion, onAccept, onReject }) {
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
      {isPending && (
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
    cases, entities, relationships, aiSuggestions, analyzing, analysisStep,
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
  const prevCaseIdRef = useRef(null)

  useEffect(() => {
    if (contextCaseId && cases.find(c => c.id === contextCaseId)) {
      const next = cases.find(c => c.id === contextCaseId)
      setSelectedCaseLocal(next)
      if (prevCaseIdRef.current !== next?.id) {
        prevCaseIdRef.current = next?.id
        setSearchEntity('')
        setFilters({ type: 'all', risk: 'all' })
        setSelectedNetworkNode(null)
      }
    } else if (!selectedCaseLocal && cases.length > 0) {
      setSelectedCaseLocal(cases[0])
    }
  }, [contextCaseId, cases])

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

  useEffect(() => {
    if (networkFocusEntity) {
      const ent = caseEntities.find(e => e.id === networkFocusEntity)
      if (ent) setSelectedNetworkNode(ent.id)
    }
  }, [networkFocusEntity, caseEntities])

  const graphNodes = useMemo(() => caseEntities.map(e => ({
    id: e.id, label: e.name, type: e.type?.toUpperCase() || 'OTHER',
    risk: e.risk || 'LOW', entityId: e.id,
  })), [caseEntities])

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

  const clearFilters = () => { setFilters({ type: 'all', risk: 'all' }); setSearchEntity('') }

  const handleNodeClick = (node) => { setSelectedNetworkNode(node.id) }

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

          <div className="network-controls__divider" />

          <button type="button" className="btn btn--primary btn--sm btn--full" onClick={() => setAddEntityModalOpen(true)}>
            <Icon name="plus" className="icon-xs" /> Add Entity
          </button>
          <button type="button" className="btn btn--accent btn--sm btn--full" onClick={() => setAddRelationshipModalOpen(true)}
            disabled={caseEntities.length < 2} title={caseEntities.length < 2 ? 'Need at least 2 entities' : ''}>
            <Icon name="link" className="icon-xs" /> Add Relationship
          </button>

          <div className="network-controls__divider" />

          <button type="button" className="btn btn--primary btn--sm btn--full"
            onClick={handleRunAnalysis}
            disabled={analyzing || caseEntities.length < 2}>
            {analyzing ? (
              <><Icon name="spinner" className="icon-xs" /> Analyzing...</>
            ) : (
              <><Icon name="zap" className="icon-xs" /> AI Analyze Case</>
            )}
          </button>
          {caseEntities.length < 2 && (
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
            <span className="network-canvas__info">{graphNodes.length} nodes · {graphEdges.length} edges</span>
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
              <div className="network-empty-state__actions">
                <button type="button" className="btn btn--primary" onClick={() => setAddEntityModalOpen(true)}>
                  <Icon name="plus" className="icon-xs" /> Add Entity
                </button>
              </div>
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
          onAddToInvestigation={() => { if (selectedEntity) showToast(`${selectedEntity.name} added to active investigation`, 'success') }}
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
              <button type="button" className="btn btn--primary btn--sm" onClick={handleRunAnalysis} disabled={caseEntities.length < 2}>
                <Icon name="zap" className="icon-xs" /> Re-run Analysis
              </button>
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
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AddEntityModal open={addEntityModalOpen} onClose={() => setAddEntityModalOpen(false)} onAdd={addEntity} caseId={selectedCaseLocal?.id} />
      <AddRelationshipModal open={addRelationshipModalOpen} onClose={() => setAddRelationshipModalOpen(false)} onAdd={addRelationship}
        caseId={selectedCaseLocal?.id} entities={entities} />
    </div>
  )
}
