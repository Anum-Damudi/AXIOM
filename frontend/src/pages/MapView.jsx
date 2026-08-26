import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import RiskBadge from '../components/RiskBadge'

const MAP_LOCATIONS = [
  { id: 'LOC-001', name: 'Mumbai Hub', city: 'Mumbai', state: 'Maharashtra', lat: '19.0760° N', lng: '72.8777° E', risk: 'HIGH', type: 'Warehouse District', cases: ['NX-2026-041', 'NX-2026-029'], entities: 5, lastActivity: '2026-08-26', x: 35, y: 52, description: 'Primary logistics hub linked to Shadow Ledger operations. GPS clusters confirm suspect vehicle presence.' },
  { id: 'LOC-002', name: 'Delhi Safe House', city: 'New Delhi', state: 'Delhi', lat: '28.7041° N', lng: '77.1025° E', risk: 'HIGH', type: 'Safe House', cases: ['NX-2026-037'], entities: 3, lastActivity: '2026-08-25', x: 42, y: 28, description: 'Encrypted communication hub. Ghost Wire (Priya M.) linked to this location.' },
  { id: 'LOC-003', name: 'Pune Operations Center', city: 'Pune', state: 'Maharashtra', lat: '18.5204° N', lng: '73.8567° E', risk: 'MEDIUM', type: 'Operations Center', cases: ['NX-2026-029'], entities: 2, lastActivity: '2026-08-23', x: 33, y: 56, description: 'Vehicle staging area for theft ring operations. Arun S. confirmed present.' },
  { id: 'LOC-004', name: 'Bangalore Tech Lab', city: 'Bangalore', state: 'Karnataka', lat: '12.9716° N', lng: '77.5946° E', risk: 'MEDIUM', type: 'Technology Lab', cases: ['NX-2026-037'], entities: 2, lastActivity: '2026-08-22', x: 38, y: 72, description: 'Suspected encryption services lab operated by Deepak V. (Cipher).' },
  { id: 'LOC-005', name: 'Chennai Port Office', city: 'Chennai', state: 'Tamil Nadu', lat: '13.0827° N', lng: '80.2707° E', risk: 'LOW', type: 'Port Facility', cases: ['NX-2026-024'], entities: 1, lastActivity: '2026-08-18', x: 48, y: 68, description: 'Cross-border syndicate transit point. Document forgery activities detected.' },
  { id: 'LOC-006', name: 'Dubai Liaison Office', city: 'Dubai', state: 'UAE', lat: '25.2048° N', lng: '55.2708° E', risk: 'HIGH', type: 'Financial Hub', cases: ['NX-2026-041'], entities: 3, lastActivity: '2026-08-26', x: 25, y: 42, description: 'Offshore financial operations. Rajesh K. linked to fund transfers through shell companies.' },
  { id: 'LOC-007', name: 'Singapore Relay', city: 'Singapore', state: 'Singapore', lat: '1.3521° N', lng: '103.8198° E', risk: 'MEDIUM', type: 'Communication Relay', cases: ['NX-2026-037', 'NX-2026-041'], entities: 2, lastActivity: '2026-08-24', x: 72, y: 78, description: 'Encrypted communication relay point. Priya M. managing operations from this node.' },
]

export default function MapView() {
  const { navigate } = useApp()
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')

  const locationTypes = useMemo(() => ['All', ...new Set(MAP_LOCATIONS.map(l => l.type))], [])

  const filtered = useMemo(() => {
    return MAP_LOCATIONS.filter(l => {
      if (searchQuery && !l.name.toLowerCase().includes(searchQuery.toLowerCase()) && !l.city.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (riskFilter !== 'All' && l.risk !== riskFilter) return false
      if (typeFilter !== 'All' && l.type !== typeFilter) return false
      return true
    })
  }, [searchQuery, riskFilter, typeFilter])

  const stats = useMemo(() => ({
    total: MAP_LOCATIONS.length,
    high: MAP_LOCATIONS.filter(l => l.risk === 'HIGH').length,
    medium: MAP_LOCATIONS.filter(l => l.risk === 'MEDIUM').length,
    low: MAP_LOCATIONS.filter(l => l.risk === 'LOW').length,
    entities: MAP_LOCATIONS.reduce((sum, l) => sum + l.entities, 0),
  }), [])

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Map View</h1>
          <p className="page-header__desc">Geographic investigation visualization</p>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__icon"><Icon name="map" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">Total Locations</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ color: 'var(--risk-high)' }}><Icon name="alert" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{stats.high}</span>
            <span className="stat-card__label">High Risk</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ color: 'var(--risk-medium)' }}><Icon name="alert" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{stats.medium}</span>
            <span className="stat-card__label">Medium Risk</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon"><Icon name="users" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{stats.entities}</span>
            <span className="stat-card__label">Linked Entities</span>
          </div>
        </div>
      </section>

      <div className="map-workspace">
        <aside className="map-sidebar panel">
          <div className="map-sidebar__search">
            <Icon name="search" className="icon-sm" />
            <input type="text" placeholder="Search locations..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <div className="map-sidebar__filters">
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
              <option value="All">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              {locationTypes.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
            </select>
          </div>

          <div className="map-sidebar__list">
            {filtered.map(loc => (
              <button key={loc.id} className={`map-sidebar__item ${selectedLocation?.id === loc.id ? 'map-sidebar__item--active' : ''}`} onClick={() => setSelectedLocation(loc)}>
                <div className="map-sidebar__item-header">
                  <span className="map-sidebar__item-name">{loc.name}</span>
                  <RiskBadge level={loc.risk} />
                </div>
                <span className="map-sidebar__item-city">{loc.city}, {loc.state}</span>
                <span className="map-sidebar__item-type">{loc.type}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="map-canvas panel">
          <div className="map-canvas__view">
            <div className="map-canvas__grid" aria-hidden="true" />
            <div className="map-canvas__legend">
              <span className="map-canvas__legend-item"><span className="map-canvas__legend-dot map-canvas__legend-dot--high" />High Risk</span>
              <span className="map-canvas__legend-item"><span className="map-canvas__legend-dot map-canvas__legend-dot--medium" />Medium</span>
              <span className="map-canvas__legend-item"><span className="map-canvas__legend-dot map-canvas__legend-dot--low" />Low</span>
            </div>

            {filtered.map(loc => (
              <button
                key={loc.id}
                className={`map-marker map-marker--${loc.risk.toLowerCase()} ${selectedLocation?.id === loc.id ? 'map-marker--selected' : ''}`}
                style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                onClick={() => setSelectedLocation(loc)}
                aria-label={loc.name}
              >
                <span className="map-marker__dot" />
                <span className="map-marker__pulse" aria-hidden="true" />
                <span className="map-marker__label">{loc.name}</span>
              </button>
            ))}
          </div>
        </div>

        <aside className={`map-info panel ${selectedLocation ? 'map-info--open' : ''}`}>
          {selectedLocation ? (
            <>
              <header className="map-info__header">
                <div>
                  <h3 className="map-info__title">{selectedLocation.name}</h3>
                  <span className="map-info__city">{selectedLocation.city}, {selectedLocation.state}</span>
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedLocation(null)}>
                  <Icon name="close" className="icon-xs" />
                </button>
              </header>

              <div className="map-info__details">
                <div className="map-info__row">
                  <span className="map-info__label">Type</span>
                  <span className="map-info__value">{selectedLocation.type}</span>
                </div>
                <div className="map-info__row">
                  <span className="map-info__label">Risk</span>
                  <RiskBadge level={selectedLocation.risk} />
                </div>
                <div className="map-info__row">
                  <span className="map-info__label">Coordinates</span>
                  <span className="map-info__value mono">{selectedLocation.lat}, {selectedLocation.lng}</span>
                </div>
                <div className="map-info__row">
                  <span className="map-info__label">Entities</span>
                  <span className="map-info__value">{selectedLocation.entities}</span>
                </div>
                <div className="map-info__row">
                  <span className="map-info__label">Last Activity</span>
                  <span className="map-info__value">{selectedLocation.lastActivity}</span>
                </div>
              </div>

              <div className="map-info__section">
                <h4>Description</h4>
                <p>{selectedLocation.description}</p>
              </div>

              <div className="map-info__section">
                <h4>Linked Cases</h4>
                <div className="map-info__cases">
                  {selectedLocation.cases.map(c => (
                    <button key={c} className="map-info__case-btn" onClick={() => navigate('cases', { caseId: c })}>
                      <Icon name="folder" className="icon-xs" />
                      <span className="mono">{c}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="map-info--empty">
              <Icon name="map" className="icon-md" />
              <p>Select a location to view details</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
