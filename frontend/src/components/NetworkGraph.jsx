import { useEffect, useRef, useState } from 'react'
import { ENTITY_DETAILS, NETWORK_EDGES, NETWORK_NODES } from '../data/mockData'
import Icon from './Icon'
import RiskBadge from './RiskBadge'

const NODE_SHAPES = {
  PERSON: 'circle',
  CASE: 'rect',
  PHONE: 'diamond',
  LOCATION: 'hex',
  BANK: 'rect',
  VEHICLE: 'rect',
  EVIDENCE: 'circle',
  ORGANIZATION: 'rect',
}

const TYPE_COLORS = {
  PERSON: '#22d3ee',
  CASE: '#38bdf8',
  PHONE: '#fbbf24',
  LOCATION: '#4ade80',
  BANK: '#f87171',
  VEHICLE: '#94a3b8',
  EVIDENCE: '#fb923c',
  ORGANIZATION: '#a78bfa',
}

const RELATIONSHIP_LABELS = {
  'n-rk-n-case': 'LINKED TO',
  'n-rk-n-pm': 'ASSOCIATED WITH',
  'n-rk-n-as': 'ASSOCIATED WITH',
  'n-rk-n-bank': 'TRANSFERRED FUNDS TO',
  'n-rk-n-rm': 'ASSOCIATED WITH',
  'n-pm-n-phone': 'CALLED',
  'n-as-n-veh': 'USED',
  'n-as-n-loc': 'LOCATED AT',
  'n-case-n-evd': 'LINKED TO',
  'n-rk-n-evd': 'LINKED TO',
  'n-pm-n-case': 'LINKED TO',
  'n-rm-n-case': 'LINKED TO',
}

function NodeShape({ node, selected, onClick, style }) {
  const color = TYPE_COLORS[node.type] || '#22d3ee'
  const isHigh = node.risk === 'HIGH' || node.risk === 'CRITICAL'
  const shape = NODE_SHAPES[node.type] || 'circle'

  const common = {
    className: `network-node__shape ${selected ? 'network-node__shape--selected' : ''}`,
    stroke: isHigh ? 'var(--risk-high)' : color,
    fill: `${color}22`,
    strokeWidth: selected ? 2.5 : 1.5,
    onClick: () => onClick(node),
    style: { cursor: 'pointer', ...style },
  }

  if (shape === 'rect') {
    return <rect x={node.x - 18} y={node.y - 12} width={36} height={24} rx={4} {...common} />
  }
  if (shape === 'diamond') {
    return (
      <polygon
        points={`${node.x},${node.y - 14} ${node.x + 14},${node.y} ${node.x},${node.y + 14} ${node.x - 14},${node.y}`}
        {...common}
      />
    )
  }
  return <circle cx={node.x} cy={node.y} r={node.type === 'PERSON' ? 16 : 12} {...common} />
}

export default function NetworkGraph({
  interactive = false,
  selectedNodeId,
  onNodeClick,
  zoom = 1,
  panX = 0,
  panY = 0,
  filters = {},
  focusEntityId,
  rotating = false,
}) {
  const [hoveredId, setHoveredId] = useState(null)
  const [rotationAngle, setRotationAngle] = useState(0)
  const animRef = useRef(null)

  useEffect(() => {
    if (rotating) {
      let lastTime = performance.now()
      const animate = (now) => {
        const dt = (now - lastTime) / 1000
        lastTime = now
        setRotationAngle((prev) => (prev + dt * 30) % 360)
        animRef.current = requestAnimationFrame(animate)
      }
      animRef.current = requestAnimationFrame(animate)
      return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [rotating])

  const filteredNodes = NETWORK_NODES.filter((n) => {
    if (filters.risk && filters.risk !== 'all' && n.risk.toLowerCase() !== filters.risk) return false
    if (filters.type && filters.type !== 'all' && n.type !== filters.type) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!n.label.toLowerCase().includes(q) && !n.id.toLowerCase().includes(q) && !(n.type || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const visibleIds = new Set(filteredNodes.map((n) => n.id))
  const nodeMap = Object.fromEntries(NETWORK_NODES.map((n) => [n.id, n]))

  const filteredEdges = NETWORK_EDGES.filter(([a, b]) => visibleIds.has(a) && visibleIds.has(b))

  const focusNode = focusEntityId
    ? filteredNodes.find((n) => n.entityId === focusEntityId)
    : null

  const cx = 400
  const cy = 260
  const angleRad = (rotationAngle * Math.PI) / 180

  const getRotatedPos = (node) => {
    if (!rotating) return { x: node.x, y: node.y }
    const dx = node.x - cx
    const dy = node.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const origAngle = Math.atan2(dy, dx)
    return {
      x: cx + dist * Math.cos(origAngle + angleRad),
      y: cy + dist * Math.sin(origAngle + angleRad),
    }
  }

  return (
    <div className={`network-graph ${interactive ? 'network-graph--interactive' : ''}`}>
      <svg viewBox="0 0 800 520" className="network-graph__svg" aria-label="Criminal network visualization">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
          </marker>
        </defs>
        <g transform={`translate(${panX} ${panY}) translate(400 260) scale(${zoom}) translate(-400 -260)`}>
          {filteredEdges.map(([a, b]) => {
            const na = nodeMap[a]
            const nb = nodeMap[b]
            const posA = getRotatedPos(na)
            const posB = getRotatedPos(nb)
            const highlighted = hoveredId === a || hoveredId === b || selectedNodeId === a || selectedNodeId === b
            const edgeKey = `${a}-${b}`
            const label = RELATIONSHIP_LABELS[edgeKey]
            const midX = (posA.x + posB.x) / 2
            const midY = (posA.y + posB.y) / 2
            return (
              <g key={edgeKey}>
                <line
                  x1={posA.x}
                  y1={posA.y}
                  x2={posB.x}
                  y2={posB.y}
                  className={`network-graph__edge ${highlighted ? 'network-graph__edge--active' : ''}`}
                  markerEnd={highlighted ? 'url(#arrowhead)' : undefined}
                />
                {label && highlighted && (
                  <text x={midX} y={midY - 6} className="network-graph__edge-label" textAnchor="middle">
                    {label}
                  </text>
                )}
              </g>
            )
          })}
          {filteredNodes.map((node) => {
            const pos = getRotatedPos(node)
            const rotatedNode = { ...node, x: pos.x, y: pos.y }
            return (
              <g
                key={node.id}
                className={`network-node network-node--${node.type.toLowerCase()}`}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {focusNode?.id === node.id && (
                  <circle cx={pos.x} cy={pos.y} r={28} className="network-node__focus-ring" />
                )}
                <NodeShape
                  node={rotatedNode}
                  selected={selectedNodeId === node.id}
                  onClick={onNodeClick || (() => {})}
                />
                <text x={pos.x} y={pos.y + 28} className="network-graph__label">
                  {node.label}
                </text>
                <text x={pos.x} y={pos.y + 40} className="network-graph__type">
                  {node.type}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

export function EntityPanel({ nodeId, onClose, onViewProfile, onViewConnections, onAddToInvestigation }) {
  const details = ENTITY_DETAILS[nodeId]
  if (!details) {
    return (
      <div className="entity-panel entity-panel--empty">
        <div className="entity-panel__empty-icon">
          <Icon name="network" className="icon-lg" />
        </div>
        <p>Select a node to view intelligence data</p>
        <span className="entity-panel__empty-hint">Click any entity in the graph to inspect its profile, relationships, and activity.</span>
      </div>
    )
  }

  const node = NETWORK_NODES.find((n) => n.id === nodeId)
  const connections = NETWORK_EDGES.filter(([a, b]) => a === nodeId || b === nodeId)
  const connectedNodes = connections.map(([a, b]) => {
    const otherId = a === nodeId ? b : a
    return { ...nodeMap[otherId], relationship: RELATIONSHIP_LABELS[`${a}-${b}`] || RELATIONSHIP_LABELS[`${b}-${a}`] || 'CONNECTED' }
  }).filter(Boolean)

  return (
    <div className="entity-panel">
      <header className="entity-panel__header">
        <h3>Entity Intelligence</h3>
        {onClose && (
          <button type="button" className="entity-panel__close" onClick={onClose} aria-label="Close">
            <Icon name="close" className="icon-sm" />
          </button>
        )}
      </header>
      <div className="entity-panel__body">
        <div className="entity-panel__identity">
          <h4 className="entity-panel__name">{details.name}</h4>
          {node && <span className="entity-panel__id">{node.id} · {node.entityId || 'N/A'}</span>}
          <div className="entity-panel__meta">
            <span className="entity-panel__type">{details.type}</span>
            <RiskBadge level={details.risk} />
          </div>
        </div>

        <dl className="entity-panel__dl">
          <div><dt>Connections</dt><dd>{connections.length} direct</dd></div>
          <div><dt>Evidence</dt><dd>{details.evidenceCount} items</dd></div>
          <div><dt>Last Activity</dt><dd>{details.lastActivity}</dd></div>
        </dl>

        <div className="entity-panel__section">
          <span className="entity-panel__section-label">AI Summary</span>
          <p className="entity-panel__summary">{details.summary}</p>
        </div>

        {connectedNodes.length > 0 && (
          <div className="entity-panel__section">
            <span className="entity-panel__section-label">Relationships</span>
            <div className="entity-panel__relationships">
              {connectedNodes.map((cn, i) => (
                <div key={i} className="entity-panel__rel-item">
                  <span className="entity-panel__rel-label">{cn.relationship}</span>
                  <span className="entity-panel__rel-name">{cn.label}</span>
                  <span className="entity-panel__rel-type">{cn.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {details.cases && details.cases.length > 0 && (
          <div className="entity-panel__section">
            <span className="entity-panel__section-label">Linked Cases</span>
            <div className="entity-panel__cases">
              {details.cases.map((c, i) => (
                <span key={i} className="entity-panel__case-tag">{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <footer className="entity-panel__footer">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onViewProfile}>View Profile</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onViewConnections}>Connections</button>
        <button type="button" className="btn btn--accent btn--sm" onClick={onAddToInvestigation}>Add to Investigation</button>
      </footer>
    </div>
  )
}

const nodeMap = Object.fromEntries(NETWORK_NODES.map((n) => [n.id, n]))
