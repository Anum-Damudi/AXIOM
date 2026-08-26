import { useCallback, useEffect, useRef, useState } from 'react'
import { NETWORK_NODES, NETWORK_EDGES, CASES, INVESTIGATIONS } from '../data/mockData'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import NetworkGraph, { EntityPanel } from '../components/NetworkGraph'

const RELATIONSHIP_TYPES = ['all', 'PERSON', 'CASE', 'PHONE', 'LOCATION', 'BANK', 'VEHICLE', 'EVIDENCE']
const RISK_LEVELS = ['all', 'high', 'medium', 'low']

const TIMELINE_EVENTS = [
  { time: '08:40', event: 'Phone connection identified between Rajesh K. and Priya M.', type: 'communication' },
  { time: '09:15', event: 'Financial relationship detected — offshore account linked', type: 'financial' },
  { time: '10:20', event: 'New associate discovered: Rohan Mehta (SUS-0055)', type: 'person' },
  { time: '11:05', event: 'Vehicle MH-12-AB-4471 linked to suspect movement', type: 'vehicle' },
  { time: '12:30', event: 'Location overlap detected — Mumbai warehouse district', type: 'location' },
]

export default function NetworkAnalysis() {
  const {
    activeInvestigation,
    selectedNetworkNode,
    setSelectedNetworkNode,
    networkFocusEntity,
    navigate,
    showToast,
  } = useApp()

  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [rotating, setRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedCase, setSelectedCase] = useState(CASES[0])
  const [showTimeline, setShowTimeline] = useState(false)
  const [searchEntity, setSearchEntity] = useState('')
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const canvasRef = useRef(null)
  const [filters, setFilters] = useState({
    type: 'all',
    risk: 'all',
  })

  useEffect(() => {
    if (networkFocusEntity) {
      const node = NETWORK_NODES.find((n) => n.entityId === networkFocusEntity)
      if (node) setSelectedNetworkNode(node.id)
    }
  }, [networkFocusEntity, setSelectedNetworkNode])

  const clearFilters = () => {
    setFilters({ type: 'all', risk: 'all' })
    setSearchEntity('')
  }

  const handleNodeClick = (node) => {
    setSelectedNetworkNode(node.id)
  }

  const handleViewProfile = () => {
    if (!selectedNetworkNode) return
    const node = NETWORK_NODES.find((n) => n.id === selectedNetworkNode)
    const entityId = node?.entityId
    if (entityId?.startsWith('SUS')) navigate('suspects', { suspectId: entityId })
    else if (entityId?.startsWith('NX')) navigate('cases', { caseId: entityId })
    else if (entityId?.startsWith('EVD')) navigate('evidence', { evidenceId: entityId })
    else showToast(`Viewing ${node?.label || 'entity'} profile`, 'info')
  }

  const handleViewConnections = () => {
    if (!selectedNetworkNode) return
    const node = NETWORK_NODES.find((n) => n.id === selectedNetworkNode)
    if (node) {
      const connectedEdges = NETWORK_EDGES.filter(([a, b]) => a === selectedNetworkNode || b === selectedNetworkNode)
      showToast(`Found ${connectedEdges.length} direct connections for ${node.label}`, 'info')
    }
  }

  const handleAddToInvestigation = () => {
    if (!selectedNetworkNode) return
    const node = NETWORK_NODES.find((n) => n.id === selectedNetworkNode)
    if (node) {
      showToast(`${node.label} added to active investigation`, 'success')
    }
  }

  const handleResetView = () => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
    setRotating(false)
  }

  const handleFitToScreen = () => {
    if (NETWORK_NODES.length === 0) return
    const minX = Math.min(...NETWORK_NODES.map((n) => n.x))
    const maxX = Math.max(...NETWORK_NODES.map((n) => n.x))
    const minY = Math.min(...NETWORK_NODES.map((n) => n.y))
    const maxY = Math.max(...NETWORK_NODES.map((n) => n.y))
    const graphW = maxX - minX + 80
    const graphH = maxY - minY + 80
    const canvas = canvasRef.current
    if (!canvas) { setZoom(1); setPanX(0); setPanY(0); return }
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / graphW
    const scaleY = rect.height / graphH
    const newZoom = Math.min(scaleX, scaleY, 2)
    setZoom(newZoom)
    const graphCX = (minX + maxX) / 2
    const graphCY = (minY + maxY) / 2
    setPanX((rect.width / 2 - graphCX * newZoom) + (400 * (1 - newZoom)))
    setPanY((rect.height / 2 - graphCY * newZoom) + (260 * (1 - newZoom)))
  }

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX, panY }
  }, [panX, panY])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPanX(dragStart.current.panX + dx)
    setPanY(dragStart.current.panY + dy)
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setZoom((z) => Math.min(Math.max(z + delta, 0.3), 3))
  }, [])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const combinedFilters = {
    search: searchEntity,
    type: filters.type,
    risk: filters.risk,
  }

  const nodeCount = NETWORK_NODES.length
  const edgeCount = NETWORK_EDGES.length
  const selectedCaseInvestigations = INVESTIGATIONS.filter((i) => i.caseId === selectedCase?.id)

  return (
    <div className="page-content network-workspace">
      {activeInvestigation && (
        <div className="investigation-banner">
          <span className="investigation-banner__label">Active Investigation</span>
          <span className="investigation-banner__name">{activeInvestigation.name}</span>
          <span className="investigation-banner__meta">
            {activeInvestigation.priority} · {activeInvestigation.type}
          </span>
        </div>
      )}

      <div className="network-context-bar">
        <div className="network-context-bar__left">
          <label className="form-field form-field--compact">
            <span>Investigation Case</span>
            <select
              value={selectedCase?.id || ''}
              onChange={(e) => {
                const c = CASES.find((cs) => cs.id === e.target.value)
                setSelectedCase(c || CASES[0])
              }}
            >
              {CASES.map((c) => (
                <option key={c.id} value={c.id}>{c.id} — {c.title}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="network-context-bar__center">
          {selectedCase && (
            <>
              <span className="network-context-bar__case-id">{selectedCase.id}</span>
              <span className="network-context-bar__case-title">{selectedCase.title}</span>
              <span className="network-context-bar__case-status">{selectedCase.status}</span>
            </>
          )}
        </div>
        <div className="network-context-bar__right">
          <span>{nodeCount} entities</span>
          <span>{edgeCount} relationships</span>
          <span>{selectedCaseInvestigations.length} investigation{selectedCaseInvestigations.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="network-workspace__layout">
        <aside className="network-controls">
          <h3 className="network-controls__title">Filters</h3>

          <label className="form-field form-field--compact">
            <span>Search Entity</span>
            <input
              type="text"
              value={searchEntity}
              onChange={(e) => setSearchEntity(e.target.value)}
              placeholder="Name, ID, or type..."
            />
          </label>

          <label className="form-field form-field--compact">
            <span>Entity Type</span>
            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              {RELATIONSHIP_TYPES.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
              ))}
            </select>
          </label>

          <label className="form-field form-field--compact">
            <span>Risk Level</span>
            <select value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })}>
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>{r === 'all' ? 'All Levels' : r.toUpperCase()}</option>
              ))}
            </select>
          </label>

          <button type="button" className="btn btn--ghost btn--sm btn--full" onClick={clearFilters}>
            Clear Filters
          </button>

          <div className="network-controls__divider" />

          <button type="button" className="btn btn--ghost btn--sm btn--full" onClick={() => setShowTimeline(!showTimeline)}>
            <Icon name="sort" className="icon-sm" />
            {showTimeline ? 'Hide' : 'Show'} Timeline
          </button>

          {showTimeline && (
            <div className="network-timeline">
              <h4 className="network-timeline__title">Investigation Timeline</h4>
              {TIMELINE_EVENTS.map((evt, i) => (
                <div key={i} className="network-timeline__event">
                  <span className="network-timeline__time">{evt.time}</span>
                  <span className="network-timeline__text">{evt.event}</span>
                </div>
              ))}
            </div>
          )}

          <div className="network-controls__divider" />

          <div className="network-controls__legend">
            <h4 className="network-controls__legend-title">Legend</h4>
            {[
              { type: 'PERSON', color: '#22d3ee' },
              { type: 'ORGANIZATION', color: '#a78bfa' },
              { type: 'PHONE', color: '#fbbf24' },
              { type: 'LOCATION', color: '#4ade80' },
              { type: 'BANK', color: '#f87171' },
              { type: 'VEHICLE', color: '#94a3b8' },
              { type: 'CASE', color: '#38bdf8' },
              { type: 'EVIDENCE', color: '#fb923c' },
            ].map(({ type, color }) => (
              <span key={type} className="legend-item">
                <span className="legend-dot" style={{ background: color }} /> {type}
              </span>
            ))}
          </div>
        </aside>

        <div
          className="network-canvas"
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div className="network-canvas__toolbar">
            <span className="network-canvas__info">{nodeCount} nodes · {edgeCount} edges</span>
            <div className="network-canvas__zoom">
              <button type="button" className="topbar__icon-btn" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(z + 0.15, 3))}>
                <Icon name="zoomIn" className="icon-sm" />
              </button>
              <span className="network-canvas__zoom-level">{Math.round(zoom * 100)}%</span>
              <button type="button" className="topbar__icon-btn" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(z - 0.15, 0.3))}>
                <Icon name="zoomOut" className="icon-sm" />
              </button>
              <button type="button" className="topbar__icon-btn" aria-label="Reset view" onClick={handleResetView} title="Reset view">
                <Icon name="reset" className="icon-sm" />
              </button>
              <button type="button" className="topbar__icon-btn" aria-label="Fit to screen" onClick={handleFitToScreen} title="Fit to screen">
                <Icon name="maximize" className="icon-sm" />
              </button>
              <button
                type="button"
                className={`topbar__icon-btn ${rotating ? 'topbar__icon-btn--active' : ''}`}
                aria-label="Toggle rotation"
                onClick={() => setRotating((r) => !r)}
                title={rotating ? 'Stop rotation' : 'Start rotation'}
              >
                <Icon name="rotate" className="icon-sm" />
              </button>
            </div>
          </div>
          <NetworkGraph
            interactive
            selectedNodeId={selectedNetworkNode}
            onNodeClick={handleNodeClick}
            zoom={zoom}
            panX={panX}
            panY={panY}
            filters={combinedFilters}
            focusEntityId={networkFocusEntity}
            rotating={rotating}
          />
        </div>

        <EntityPanel
          nodeId={selectedNetworkNode}
          onClose={() => setSelectedNetworkNode(null)}
          onViewProfile={handleViewProfile}
          onViewConnections={handleViewConnections}
          onAddToInvestigation={handleAddToInvestigation}
        />
      </div>
    </div>
  )
}
