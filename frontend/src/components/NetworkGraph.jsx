import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import RiskBadge from './RiskBadge'

const NODE_SHAPES = {
  PERSON: 'circle', CASE: 'rect', PHONE: 'diamond', LOCATION: 'hex',
  BANK: 'rect', VEHICLE: 'rect', EVIDENCE: 'circle', ORGANIZATION: 'rect',
  OTHER: 'circle', CONTACT: 'diamond',
}

const TYPE_COLORS = {
  PERSON: '#22d3ee', CASE: '#38bdf8', PHONE: '#fbbf24', LOCATION: '#4ade80',
  BANK: '#f87171', VEHICLE: '#94a3b8', EVIDENCE: '#fb923c', ORGANIZATION: '#a78bfa',
  OTHER: '#94a3b8', CONTACT: '#fbbf24',
}

const RELATIONSHIP_LABELS = {
  ASSOCIATED_WITH: 'ASSOCIATED WITH', USES: 'USES', LOCATED_AT: 'LOCATED AT',
  OWNS: 'OWNS', LINKED_TO: 'LINKED TO', RELATED_TO: 'RELATED TO',
  CONNECTED_TO: 'CONNECTED TO', CALLED: 'CALLED', TRANSFERRED_FUNDS_TO: 'TRANSFERRED FUNDS TO',
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
  if (shape === 'hex') {
    const r = 14
    const points = Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      return `${node.x + r * Math.cos(angle)},${node.y + r * Math.sin(angle)}`
    }).join(' ')
    return <polygon points={points} {...common} />
  }
  return <circle cx={node.x} cy={node.y} r={node.type === 'PERSON' ? 16 : 12} {...common} />
}

function layoutNodes(nodes, width = 800, height = 520) {
  if (nodes.length === 0) return []
  if (nodes.length === 1) return [{ ...nodes[0], x: width / 2, y: height / 2 }]

  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.35
  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
    return { ...node, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
  })
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
  nodes: nodesProp,
  edges: edgesProp,
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
        setRotationAngle(prev => (prev + dt * 30) % 360)
        animRef.current = requestAnimationFrame(animate)
      }
      animRef.current = requestAnimationFrame(animate)
      return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [rotating])

  const allNodes = nodesProp || []
  const allEdges = edgesProp || []

  const filteredNodes = allNodes.filter(n => {
    if (filters.risk && filters.risk !== 'all' && (n.risk || '').toLowerCase() !== filters.risk) return false
    if (filters.type && filters.type !== 'all' && n.type !== filters.type) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!(n.label || '').toLowerCase().includes(q) && !n.id.toLowerCase().includes(q) && !(n.type || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const visibleIds = new Set(filteredNodes.map(n => n.id))
  const nodeMap = Object.fromEntries(allNodes.map(n => [n.id, n]))

  const filteredEdges = allEdges.filter(e => {
    const a = typeof e === 'string' || typeof e === 'number' ? e : e[0] || e.from
    const b = typeof e === 'string' || typeof e === 'number' ? e : e[1] || e.to
    return visibleIds.has(a) && visibleIds.has(b)
  })

  const laidOutNodes = layoutNodes(filteredNodes)

  const focusNode = focusEntityId ? laidOutNodes.find(n => n.entityId === focusEntityId) : null

  const cx = 400
  const cy = 260
  const angleRad = (rotationAngle * Math.PI) / 180

  const getRotatedPos = (node) => {
    if (!rotating) return { x: node.x, y: node.y }
    const dx = node.x - cx
    const dy = node.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const origAngle = Math.atan2(dy, dx)
    return { x: cx + dist * Math.cos(origAngle + angleRad), y: cy + dist * Math.sin(origAngle + angleRad) }
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
          {filteredEdges.map((edge, i) => {
            const a = typeof edge === 'string' || typeof edge === 'number' ? edge : edge[0] || edge.from
            const b = typeof edge === 'string' || typeof edge === 'number' ? edge : edge[1] || edge.to
            const na = nodeMap[a]
            const nb = nodeMap[b]
            if (!na || !nb) return null
            const posA = getRotatedPos(laidOutNodes.find(n => n.id === a) || na)
            const posB = getRotatedPos(laidOutNodes.find(n => n.id === b) || nb)
            const highlighted = hoveredId === a || hoveredId === b || selectedNodeId === a || selectedNodeId === b
            const edgeType = typeof edge === 'object' && edge.type ? edge.type : null
            const edgeLabel = edgeType ? RELATIONSHIP_LABELS[edgeType] || edgeType : null
            const midX = (posA.x + posB.x) / 2
            const midY = (posA.y + posB.y) / 2
            return (
              <g key={`edge-${a}-${b}-${i}`}>
                <line x1={posA.x} y1={posA.y} x2={posB.x} y2={posB.y}
                  className={`network-graph__edge ${highlighted ? 'network-graph__edge--active' : ''}`}
                  markerEnd={highlighted ? 'url(#arrowhead)' : undefined}
                />
                {edgeLabel && highlighted && (
                  <text x={midX} y={midY - 6} className="network-graph__edge-label" textAnchor="middle">
                    {edgeLabel}
                  </text>
                )}
              </g>
            )
          })}
          {laidOutNodes.map(node => {
            const pos = getRotatedPos(node)
            const rotatedNode = { ...node, x: pos.x, y: pos.y }
            return (
              <g key={node.id} className={`network-node network-node--${(node.type || 'other').toLowerCase()}`}
                onMouseEnter={() => setHoveredId(node.id)} onMouseLeave={() => setHoveredId(null)}>
                {focusNode?.id === node.id && <circle cx={pos.x} cy={pos.y} r={28} className="network-node__focus-ring" />}
                <NodeShape node={rotatedNode} selected={selectedNodeId === node.id} onClick={onNodeClick || (() => {})} />
                <text x={pos.x} y={pos.y + 28} className="network-graph__label">{node.label}</text>
                <text x={pos.x} y={pos.y + 40} className="network-graph__type">{node.type}</text>
              </g>
            )
          })}
          {laidOutNodes.length === 0 && (
            <text x={400} y={260} textAnchor="middle" fill="var(--text-muted)" fontSize="14" fontFamily="var(--font-sans)">
              No entities to display
            </text>
          )}
        </g>
      </svg>
    </div>
  )
}

export function EntityPanel({ nodeId, onClose, onViewProfile, onViewConnections, onAddToInvestigation, node: nodeProp, relationships: relsProp, entities: entitiesProp }) {
  const node = nodeProp
  const allRels = relsProp || []
  const allEntities = entitiesProp || []

  if (!node) {
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

  const nodeRels = allRels.filter(r => r.fromId === nodeId || r.toId === nodeId)
  const connectedEntities = nodeRels.map(r => {
    const otherId = r.fromId === nodeId ? r.toId : r.fromId
    const other = allEntities.find(e => e.id === otherId)
    return { ...other, relationship: RELATIONSHIP_LABELS[r.type] || r.type || 'CONNECTED' }
  }).filter(e => e && e.name)

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
          <h4 className="entity-panel__name">{node.name || node.label}</h4>
          <span className="entity-panel__id">{node.id} {node.entityId ? `· ${node.entityId}` : ''}</span>
          <div className="entity-panel__meta">
            <span className="entity-panel__type">{node.type}</span>
            <RiskBadge level={node.risk} />
          </div>
        </div>
        <dl className="entity-panel__dl">
          <div><dt>Connections</dt><dd>{nodeRels.length} direct</dd></div>
          {node.description && <div><dt>Description</dt><dd>{node.description}</dd></div>}
        </dl>
        {connectedEntities.length > 0 && (
          <div className="entity-panel__section">
            <span className="entity-panel__section-label">Relationships</span>
            <div className="entity-panel__relationships">
              {connectedEntities.map((cn, i) => (
                <div key={i} className="entity-panel__rel-item">
                  <span className="entity-panel__rel-label">{cn.relationship}</span>
                  <span className="entity-panel__rel-name">{cn.name}</span>
                  <span className="entity-panel__rel-type">{cn.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <footer className="entity-panel__footer">
        {onViewProfile && <button type="button" className="btn btn--ghost btn--sm" onClick={onViewProfile}>View Profile</button>}
        {onViewConnections && <button type="button" className="btn btn--ghost btn--sm" onClick={onViewConnections}>Connections</button>}
        {onAddToInvestigation && <button type="button" className="btn btn--accent btn--sm" onClick={onAddToInvestigation}>Add to Investigation</button>}
      </footer>
    </div>
  )
}
