import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import Modal from '../components/Modal'

const LOCATION_TYPES = [
  'Crime Scene', 'Residence', 'Office', 'Warehouse',
  'Meeting Point', 'Vehicle Location', 'Financial Location', 'Other',
]

const TYPE_COLORS = {
  'Crime Scene': '#ef4444',
  'Residence': '#3b82f6',
  'Office': '#8b5cf6',
  'Warehouse': '#f59e0b',
  'Meeting Point': '#10b981',
  'Vehicle Location': '#06b6d4',
  'Financial Location': '#ec4899',
  'Other': '#6b7280',
}

function formatLat(lat) {
  if (lat == null) return 'N/A'
  const dir = lat >= 0 ? 'N' : 'S'
  return `${Math.abs(lat).toFixed(4)}° ${dir}`
}

function formatLng(lng) {
  if (lng == null) return 'N/A'
  const dir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lng).toFixed(4)}° ${dir}`
}

function formatTimestamp(ts) {
  if (!ts) return 'N/A'
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function computeBounds(records) {
  if (records.length === 0) return { minLat: 8, maxLat: 35, minLng: 68, maxLng: 98 }
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const r of records) {
    if (r.latitude < minLat) minLat = r.latitude
    if (r.latitude > maxLat) maxLat = r.latitude
    if (r.longitude < minLng) minLng = r.longitude
    if (r.longitude > maxLng) maxLng = r.longitude
  }
  const pad = Math.max((maxLat - minLat) * 0.25, (maxLng - minLng) * 0.25, 0.5)
  return { minLat: minLat - pad, maxLat: maxLat + pad, minLng: minLng - pad, maxLng: maxLng + pad }
}

function latLngToPercent(lat, lng, bounds) {
  const y = 100 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100
  return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) }
}

function percentToLatLng(px, py, bounds) {
  const lat = bounds.maxLat - (py / 100) * (bounds.maxLat - bounds.minLat)
  const lng = bounds.minLng + (px / 100) * (bounds.maxLng - bounds.minLng)
  return { lat, lng }
}

function getLocType(loc) {
  return loc.type || loc.locationType || 'Other'
}

function getRelatedEntityIds(loc) {
  if (loc.relatedEntityIds && loc.relatedEntityIds.length > 0) return loc.relatedEntityIds
  if (loc.entityId) return [loc.entityId]
  return []
}

function getRelatedEvidenceIds(loc) {
  return loc.relatedEvidenceIds || []
}

const EMPTY_FORM = {
  name: '', type: 'Other', description: '', caseId: '',
  latitude: '', longitude: '', address: '',
  relatedEntityIds: [], relatedEvidenceIds: [],
}

export default function MapView() {
  const { cases, entities, evidence, locations, selectedCaseId, setSelectedCaseId, addLocation, updateLocation, deleteLocation, navigate, showToast } = useApp()

  const [mapFilterCase, setMapFilterCase] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const [selectedLoc, setSelectedLoc] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingLoc, setEditingLoc] = useState(null)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formErrors, setFormErrors] = useState({})
  const [selectingOnMap, setSelectingOnMap] = useState(false)
  const [previewCoords, setPreviewCoords] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 })
  const [mapZoom, setMapZoom] = useState(1)
  const canvasRef = useRef(null)
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, moved: false })

  const activeCaseId = mapFilterCase || selectedCaseId || ''

  const filteredLocations = useMemo(() => {
    let locs = locations
    if (activeCaseId) locs = locs.filter(l => l.caseId === activeCaseId)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      locs = locs.filter(l =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q) ||
        (l.address || '').toLowerCase().includes(q)
      )
    }
    if (typeFilter !== 'ALL') {
      locs = locs.filter(l => getLocType(l) === typeFilter)
    }
    return locs
  }, [locations, activeCaseId, searchQuery, typeFilter])

  const filteredWithCoords = useMemo(
    () => filteredLocations.filter(l => l.latitude != null && l.longitude != null),
    [filteredLocations]
  )

  const pannedBounds = useMemo(() => {
    const base = computeBounds(filteredWithCoords)
    if (mapPan.x === 0 && mapPan.y === 0) return base
    const degX = (base.maxLng - base.minLng) / 200
    const degY = (base.maxLat - base.minLat) / 200
    return {
      minLat: base.minLat - mapPan.y * degY,
      maxLat: base.maxLat - mapPan.y * degY,
      minLng: base.minLng + mapPan.x * degX,
      maxLng: base.maxLng + mapPan.x * degX,
    }
  }, [filteredWithCoords, mapPan])

  const mappedLocations = useMemo(() => {
    return filteredWithCoords.map(loc => {
      const pos = latLngToPercent(loc.latitude, loc.longitude, pannedBounds)
      return { ...loc, x: pos.x, y: pos.y }
    })
  }, [filteredWithCoords, pannedBounds])

  const stats = useMemo(() => ({
    total: filteredLocations.length,
    withCoords: filteredWithCoords.length,
    types: [...new Set(filteredLocations.map(l => getLocType(l)))].length,
    cases: [...new Set(filteredLocations.map(l => l.caseId))].length,
  }), [filteredLocations, filteredWithCoords])

  useEffect(() => {
    setMapPan({ x: 0, y: 0 })
    setMapZoom(1)
  }, [activeCaseId])

  useEffect(() => {
    if (selectedLoc) {
      const stillExists = filteredLocations.find(l => l.id === selectedLoc.id)
      if (!stillExists) setSelectedLoc(null)
    }
  }, [filteredLocations, selectedLoc])

  const caseEntities = useMemo(() => {
    if (!activeCaseId) return []
    return entities.filter(e => e.caseId === activeCaseId)
  }, [entities, activeCaseId])

  const caseEvidence = useMemo(() => {
    if (!activeCaseId) return []
    return evidence.filter(e => e.caseId === activeCaseId)
  }, [evidence, activeCaseId])

  const handleOpenAdd = useCallback(() => {
    if (!activeCaseId) {
      showToast('Select a case first to add a location', 'error')
      return
    }
    const caseObj = cases.find(c => c.id === activeCaseId)
    setEditingLoc(null)
    setFormData({ ...EMPTY_FORM, caseId: activeCaseId, caseName: caseObj?.title || '' })
    setFormErrors({})
    setPreviewCoords(null)
    setShowForm(true)
  }, [activeCaseId, cases, showToast])

  const handleOpenEdit = useCallback((loc) => {
    setEditingLoc(loc)
    setFormData({
      name: loc.name || '',
      type: getLocType(loc),
      description: loc.description || '',
      caseId: loc.caseId || '',
      caseName: loc.caseName || (cases.find(c => c.id === loc.caseId)?.title || ''),
      latitude: loc.latitude != null ? String(loc.latitude) : '',
      longitude: loc.longitude != null ? String(loc.longitude) : '',
      address: loc.address || '',
      relatedEntityIds: getRelatedEntityIds(loc),
      relatedEvidenceIds: getRelatedEvidenceIds(loc),
    })
    setFormErrors({})
    setPreviewCoords(null)
    setShowForm(true)
  }, [cases])

  const handleStartMapSelect = useCallback(() => {
    setSelectingOnMap(true)
    setPreviewCoords(null)
    setShowForm(false)
    showToast('Click anywhere on the map to select coordinates', 'info')
  }, [showToast])

  const handleCancelMapSelect = useCallback(() => {
    setSelectingOnMap(false)
    setPreviewCoords(null)
    setShowForm(true)
    showToast('Map selection cancelled', 'info')
  }, [showToast])

  const handleCloseForm = useCallback(() => {
    if (selectingOnMap) {
      handleCancelMapSelect()
      return
    }
    setShowForm(false)
    setEditingLoc(null)
    setFormData({ ...EMPTY_FORM })
    setFormErrors({})
    setPreviewCoords(null)
  }, [selectingOnMap, handleCancelMapSelect])

  const validateForm = useCallback(() => {
    const errs = {}
    if (!formData.name.trim()) errs.name = 'Location name is required'
    if (!formData.caseId) errs.caseId = 'Case association is required'
    const lat = parseFloat(formData.latitude)
    const lng = parseFloat(formData.longitude)
    if (formData.latitude === '' || isNaN(lat)) errs.latitude = 'Valid latitude is required'
    else if (lat < -90 || lat > 90) errs.latitude = 'Latitude must be between -90 and 90'
    if (formData.longitude === '' || isNaN(lng)) errs.longitude = 'Valid longitude is required'
    else if (lng < -180 || lng > 180) errs.longitude = 'Longitude must be between -180 and 180'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }, [formData])

  const handleSave = useCallback(() => {
    if (!validateForm()) return
    const locData = {
      name: formData.name.trim(),
      type: formData.type,
      description: formData.description.trim(),
      caseId: formData.caseId,
      caseName: formData.caseName || (cases.find(c => c.id === formData.caseId)?.title || ''),
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      address: formData.address.trim() || 'Address not available — coordinates provided',
      relatedEntityIds: formData.relatedEntityIds,
      relatedEvidenceIds: formData.relatedEvidenceIds,
    }
    if (editingLoc) {
      updateLocation(editingLoc.id, locData)
    } else {
      addLocation(locData)
    }
    setShowForm(false)
    setEditingLoc(null)
    setFormData({ ...EMPTY_FORM })
    setPreviewCoords(null)
  }, [formData, editingLoc, validateForm, addLocation, updateLocation, cases])

  const handleDelete = useCallback((locId) => {
    deleteLocation(locId)
    setDeleteConfirmId(null)
    if (selectedLoc?.id === locId) setSelectedLoc(null)
  }, [deleteLocation, selectedLoc])

  const handleMapClick = useCallback((e) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * 100
    const py = ((e.clientY - rect.top) / rect.height) * 100
    const { lat, lng } = percentToLatLng(px, py, pannedBounds)

    if (selectingOnMap) {
      setPreviewCoords({ lat, lng })
      setFormData(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }))
      setFormErrors(prev => {
        const next = { ...prev }
        delete next.latitude
        delete next.longitude
        return next
      })
      return
    }

    const clickRadius = 3
    const clickedLoc = mappedLocations.find(loc => {
      const dx = Math.abs(loc.x - px)
      const dy = Math.abs(loc.y - py)
      return dx < clickRadius && dy < clickRadius
    })
    if (clickedLoc) {
      setSelectedLoc(clickedLoc)
    } else {
      setSelectedLoc(null)
    }
  }, [selectingOnMap, mappedLocations, pannedBounds])

  const handleConfirmMapSelection = useCallback(() => {
    if (!previewCoords) return
    setSelectingOnMap(false)
    setPreviewCoords(null)
    setShowForm(true)
    showToast('Coordinates selected', 'success')
  }, [previewCoords, showToast])

  const handleCanvasMouseDown = useCallback((e) => {
    if (selectingOnMap) return
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, moved: false }
  }, [selectingOnMap])

  const handleCanvasMouseMove = useCallback((e) => {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true
    setMapPan({ x: dx / 4, y: dy / 4 })
  }, [])

  const handleCanvasMouseUp = useCallback(() => {
    dragRef.current.dragging = false
  }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setMapZoom(prev => Math.max(0.5, Math.min(3, prev + delta)))
  }, [])

  const handleSelectLocationInList = useCallback((loc) => {
    setSelectedLoc(loc)
  }, [])

  const getEntityName = useCallback((id) => {
    const e = entities.find(ent => ent.id === id)
    return e?.name || id
  }, [entities])

  const getEvidenceTitle = useCallback((id) => {
    const e = evidence.find(ev => ev.id === id)
    return e?.title || id
  }, [evidence])

  const toggleRelatedEntity = useCallback((entityId) => {
    setFormData(prev => {
      const ids = prev.relatedEntityIds.includes(entityId)
        ? prev.relatedEntityIds.filter(id => id !== entityId)
        : [...prev.relatedEntityIds, entityId]
      return { ...prev, relatedEntityIds: ids }
    })
  }, [])

  const toggleRelatedEvidence = useCallback((evidenceId) => {
    setFormData(prev => {
      const ids = prev.relatedEvidenceIds.includes(evidenceId)
        ? prev.relatedEvidenceIds.filter(id => id !== evidenceId)
        : [...prev.relatedEvidenceIds, evidenceId]
      return { ...prev, relatedEvidenceIds: ids }
    })
  }, [])

  const fmtCoords = useCallback((lat, lng) => {
    if (lat == null || lng == null) return 'No coordinates'
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }, [])

  if (!selectedCaseId && !mapFilterCase) {
    return (
      <div className="page-content">
        <header className="page-header">
          <div>
            <h1>Intelligence Map</h1>
            <p className="page-header__desc">Select a case to view intelligence locations</p>
          </div>
        </header>
        <div className="empty-state">
          <Icon name="map" className="icon-lg" />
          <h3>No Case Selected</h3>
          <p>Select a case from the sidebar or Cases page to view intelligence locations.</p>
          <button className="btn btn--primary" onClick={() => navigate('cases')}>Open Cases</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Intelligence Map</h1>
          <p className="page-header__desc">
            {activeCaseId && <span className="mono">{activeCaseId}</span>}
            {activeCaseId && ` — ${cases.find(c => c.id === activeCaseId)?.title || ''}`}
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary btn--sm" onClick={handleOpenAdd}>
            <Icon name="plus" className="icon-xs" /> Add Location
          </button>
        </div>
      </header>

      <div className="map-case-filter-bar">
        <label className="map-case-filter-label">Investigating Case</label>
        <select
          className="map-case-filter-select"
          value={activeCaseId}
          onChange={(e) => {
            setMapFilterCase(e.target.value)
            setSelectedLoc(null)
          }}
        >
          <option value="">All Cases</option>
          {cases.map(c => (
            <option key={c.id} value={c.id}>{c.id} — {c.title}</option>
          ))}
        </select>
      </div>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__icon"><Icon name="map" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">Locations</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ color: '#22c55e' }}><Icon name="check" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{stats.withCoords}</span>
            <span className="stat-card__label">With Coordinates</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ color: '#8b5cf6' }}><Icon name="network" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{stats.types}</span>
            <span className="stat-card__label">Location Types</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ color: '#3b82f6' }}><Icon name="folder" className="icon-md" /></div>
          <div className="stat-card__info">
            <span className="stat-card__value">{stats.cases}</span>
            <span className="stat-card__label">Cases</span>
          </div>
        </div>
      </section>

      {selectingOnMap && (
        <div className="map-select-banner">
          <Icon name="map" className="icon-sm" />
          <span>
            {previewCoords
              ? `Selected: ${previewCoords.lat.toFixed(6)}, ${previewCoords.lng.toFixed(6)}`
              : 'Click anywhere on the map to select coordinates'
            }
          </span>
          {previewCoords && (
            <button className="btn btn--primary btn--sm" onClick={handleConfirmMapSelection}>
              Confirm Location
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={handleCancelMapSelect}>
            Cancel
          </button>
        </div>
      )}

      <div className="map-workspace">
        <aside className="map-sidebar panel">
          <div className="map-sidebar__search">
            <Icon name="search" className="icon-sm" />
            <input
              type="text"
              placeholder="Search locations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="map-sidebar__filters" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ fontSize: 12 }}>
              <option value="ALL">All Types</option>
              {LOCATION_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="map-sidebar__list">
            {mappedLocations.length > 0 ? mappedLocations.map(loc => {
              const lType = getLocType(loc)
              const color = TYPE_COLORS[lType] || TYPE_COLORS['Other']
              const relEntities = getRelatedEntityIds(loc)
              const relEvidence = getRelatedEvidenceIds(loc)
              return (
                <button
                  key={loc.id}
                  className={`loc-card ${selectedLoc?.id === loc.id ? 'loc-card--active' : ''}`}
                  onClick={() => handleSelectLocationInList(loc)}
                >
                  <div className="loc-card__header">
                    <span className="loc-card__dot" style={{ background: color }} />
                    <span className="loc-card__name">{loc.name}</span>
                  </div>
                  <div className="loc-card__meta">
                    <span className="loc-card__type" style={{ color }}>{lType}</span>
                    {loc.caseId && <span className="loc-card__case mono">{loc.caseId}</span>}
                  </div>
                  <div className="loc-card__coords">
                    {fmtCoords(loc.latitude, loc.longitude)}
                  </div>
                  <div className="loc-card__counts">
                    {relEntities.length > 0 && (
                      <span className="loc-card__count">
                        <Icon name="users" className="icon-xs" /> {relEntities.length}
                      </span>
                    )}
                    {relEvidence.length > 0 && (
                      <span className="loc-card__count">
                        <Icon name="document" className="icon-xs" /> {relEvidence.length}
                      </span>
                    )}
                  </div>
                </button>
              )
            }) : (
              <div className="empty-state" style={{ padding: 16 }}>
                <Icon name="map" className="icon-md" />
                <p style={{ fontSize: 13 }}>
                  {activeCaseId
                    ? 'No intelligence locations have been added for this case.'
                    : 'No locations found.'
                  }
                </p>
                {activeCaseId && (
                  <button className="btn btn--primary btn--sm" onClick={handleOpenAdd} style={{ marginTop: 8 }}>
                    <Icon name="plus" className="icon-xs" /> Add Location
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        <div
          className={`map-canvas panel ${selectingOnMap ? 'map-canvas--selecting' : ''}`}
          ref={canvasRef}
          onClick={handleMapClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
        >
          <div className="map-canvas__view">
            <div className="map-canvas__grid" aria-hidden="true" />

            <div className="map-canvas__legend">
              {LOCATION_TYPES.slice(0, 6).map(t => (
                <span key={t} className="map-canvas__legend-item">
                  <span className="map-canvas__legend-dot" style={{ background: TYPE_COLORS[t] }} />{t}
                </span>
              ))}
            </div>

            {mappedLocations.length === 0 && !selectingOnMap && (
              <div className="map-empty-overlay">
                <Icon name="map" className="icon-lg" />
                <p>
                  {activeCaseId
                    ? 'No intelligence locations have been added for this case.'
                    : 'No location data available.'
                  }
                </p>
                {activeCaseId && (
                  <button className="btn btn--primary btn--sm" onClick={handleOpenAdd}>
                    <Icon name="plus" className="icon-xs" /> Add Location
                  </button>
                )}
              </div>
            )}

            {mappedLocations.map(loc => {
              const lType = getLocType(loc)
              const color = TYPE_COLORS[lType] || TYPE_COLORS['Other']
              const isSelected = selectedLoc?.id === loc.id
              return (
                <button
                  key={loc.id}
                  className={`map-marker ${isSelected ? 'map-marker--selected' : ''}`}
                  style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                  onClick={(e) => { e.stopPropagation(); setSelectedLoc(loc) }}
                  aria-label={loc.name}
                >
                  <span className="map-marker__dot" style={{ background: color }} />
                  <span className="map-marker__pulse" style={{ background: color }} aria-hidden="true" />
                  <span className="map-marker__label">{loc.name}</span>
                </button>
              )
            })}

            {previewCoords && (
              <div
                className="map-preview-marker"
                style={{
                  left: `${latLngToPercent(previewCoords.lat, previewCoords.lng, pannedBounds).x}%`,
                  top: `${latLngToPercent(previewCoords.lat, previewCoords.lng, pannedBounds).y}%`,
                }}
              >
                <span className="map-preview-marker__dot" />
                <span className="map-preview-marker__pulse" />
                <span className="map-preview-marker__label">
                  {previewCoords.lat.toFixed(4)}, {previewCoords.lng.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>

        <aside className={`map-info panel ${selectedLoc ? 'map-info--open' : ''}`}>
          {selectedLoc ? (
            <>
              <header className="map-info__header">
                <div>
                  <h3 className="map-info__title">{selectedLoc.name}</h3>
                  <span className="map-info__city" style={{ color: TYPE_COLORS[getLocType(selectedLoc)] || TYPE_COLORS['Other'] }}>
                    {getLocType(selectedLoc)}
                  </span>
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedLoc(null)}>
                  <Icon name="close" className="icon-xs" />
                </button>
              </header>
              <div className="map-info__details">
                <div className="map-info__row">
                  <span className="map-info__label">Coordinates</span>
                  <span className="map-info__value mono" style={{ fontSize: 12 }}>
                    {formatLat(selectedLoc.latitude)}<br />
                    {formatLng(selectedLoc.longitude)}
                  </span>
                </div>
                {selectedLoc.address && (
                  <div className="map-info__row">
                    <span className="map-info__label">Address</span>
                    <span className="map-info__value" style={{ fontSize: 12 }}>{selectedLoc.address}</span>
                  </div>
                )}
                <div className="map-info__row">
                  <span className="map-info__label">Case</span>
                  <span className="map-info__value">
                    <button className="map-info__case-btn" onClick={() => navigate('cases', { caseId: selectedLoc.caseId })}>
                      <Icon name="folder" className="icon-xs" />
                      <span className="mono">{selectedLoc.caseId}</span>
                      {selectedLoc.caseName && <span style={{ marginLeft: 4 }}>{selectedLoc.caseName}</span>}
                    </button>
                  </span>
                </div>
                <div className="map-info__row">
                  <span className="map-info__label">Added</span>
                  <span className="map-info__value" style={{ fontSize: 12 }}>{formatTimestamp(selectedLoc.createdAt)}</span>
                </div>
              </div>
              {selectedLoc.description && (
                <div className="map-info__section">
                  <h4>Description</h4>
                  <p>{selectedLoc.description}</p>
                </div>
              )}
              <div className="map-info__section">
                <h4>Related Entities</h4>
                {getRelatedEntityIds(selectedLoc).length > 0 ? (
                  <div className="loc-info__tags">
                    {getRelatedEntityIds(selectedLoc).map(eid => (
                      <span key={eid} className="loc-info__tag loc-info__tag--entity">
                        <Icon name="users" className="icon-xs" />
                        {getEntityName(eid)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="loc-info__empty">No related entities</p>
                )}
              </div>
              <div className="map-info__section">
                <h4>Linked Evidence</h4>
                {getRelatedEvidenceIds(selectedLoc).length > 0 ? (
                  <div className="loc-info__tags">
                    {getRelatedEvidenceIds(selectedLoc).map(evid => (
                      <span key={evid} className="loc-info__tag loc-info__tag--evidence">
                        <Icon name="document" className="icon-xs" />
                        {getEvidenceTitle(evid)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="loc-info__empty">No linked evidence</p>
                )}
              </div>
              <div className="map-info__actions" style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
                <button className="btn btn--ghost btn--sm" onClick={() => handleOpenEdit(selectedLoc)}>
                  <Icon name="edit" className="icon-xs" /> Edit
                </button>
                <button className="btn btn--ghost btn--sm" style={{ color: '#ef4444' }} onClick={() => setDeleteConfirmId(selectedLoc.id)}>
                  <Icon name="trash" className="icon-xs" /> Delete
                </button>
              </div>
            </>
          ) : (
            <div className="map-info--empty">
              <Icon name="map" className="icon-md" />
              <p>Select a location to view details</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Click a marker on the map or an item in the sidebar.
              </p>
            </div>
          )}
        </aside>
      </div>

      <Modal
        open={showForm}
        onClose={handleCloseForm}
        title={editingLoc ? 'Edit Intelligence Location' : 'Add Intelligence Location'}
        size="lg"
        footer={
          <div className="modal__footer">
            <button className="btn btn--ghost btn--sm" onClick={handleCloseForm}>Cancel</button>
            <button className="btn btn--primary btn--sm" onClick={handleSave}>
              {editingLoc ? 'Save Changes' : 'Save Location'}
            </button>
          </div>
        }
      >
        <div className="loc-form">
          <div className="loc-form__group">
            <label className="loc-form__label">Location Name *</label>
            <input
              className={`loc-form__input ${formErrors.name ? 'loc-form__input--error' : ''}`}
              type="text"
              placeholder="e.g. Warehouse Alpha"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            {formErrors.name && <span className="loc-form__error">{formErrors.name}</span>}
          </div>

          <div className="loc-form__row">
            <div className="loc-form__group" style={{ flex: 1 }}>
              <label className="loc-form__label">Location Type</label>
              <select
                className="loc-form__select"
                value={formData.type}
                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
              >
                {LOCATION_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="loc-form__group" style={{ flex: 1 }}>
              <label className="loc-form__label">Associated Case *</label>
              <select
                className={`loc-form__select ${formErrors.caseId ? 'loc-form__input--error' : ''}`}
                value={formData.caseId}
                onChange={e => {
                  const cid = e.target.value
                  const c = cases.find(cs => cs.id === cid)
                  setFormData(prev => ({ ...prev, caseId: cid, caseName: c?.title || '' }))
                }}
              >
                <option value="">Select case...</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.id} — {c.title}</option>
                ))}
              </select>
              {formErrors.caseId && <span className="loc-form__error">{formErrors.caseId}</span>}
            </div>
          </div>

          <div className="loc-form__group">
            <label className="loc-form__label">Description / Intelligence Notes</label>
            <textarea
              className="loc-form__textarea"
              rows={3}
              placeholder="Describe this location and its intelligence significance..."
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="loc-form__divider" />

          <h4 className="loc-form__section-title">GPS / Map Location</h4>

          <div className="loc-form__row">
            <div className="loc-form__group" style={{ flex: 1 }}>
              <label className="loc-form__label">Latitude *</label>
              <input
                className={`loc-form__input ${formErrors.latitude ? 'loc-form__input--error' : ''}`}
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                placeholder="e.g. 19.0760"
                value={formData.latitude}
                onChange={e => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
              />
              {formErrors.latitude && <span className="loc-form__error">{formErrors.latitude}</span>}
            </div>
            <div className="loc-form__group" style={{ flex: 1 }}>
              <label className="loc-form__label">Longitude *</label>
              <input
                className={`loc-form__input ${formErrors.longitude ? 'loc-form__input--error' : ''}`}
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                placeholder="e.g. 72.8777"
                value={formData.longitude}
                onChange={e => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
              />
              {formErrors.longitude && <span className="loc-form__error">{formErrors.longitude}</span>}
            </div>
          </div>

          <div className="loc-form__group">
            <label className="loc-form__label">Address / Location Description</label>
            <input
              className="loc-form__input"
              type="text"
              placeholder="Enter address or leave blank for coordinates only"
              value={formData.address}
              onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
            />
            <span className="loc-form__hint">Address not available — coordinates provided</span>
          </div>

          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={handleStartMapSelect}
            style={{ alignSelf: 'flex-start', marginBottom: 12 }}
          >
            <Icon name="map" className="icon-xs" /> Select on Map
          </button>

          {previewCoords && (
            <div className="loc-form__preview">
              <Icon name="check" className="icon-xs" style={{ color: '#22c55e' }} />
              <span>Selected: {previewCoords.lat.toFixed(6)}, {previewCoords.lng.toFixed(6)}</span>
              <button className="btn btn--ghost btn--xs" onClick={() => { setPreviewCoords(null); setFormData(prev => ({ ...prev, latitude: '', longitude: '' })) }}>
                Clear
              </button>
            </div>
          )}

          <div className="loc-form__divider" />

          <h4 className="loc-form__section-title">Related Entities</h4>
          {caseEntities.length > 0 ? (
            <div className="loc-form__checkbox-list">
              {caseEntities.map(ent => (
                <label key={ent.id} className="loc-form__checkbox">
                  <input
                    type="checkbox"
                    checked={formData.relatedEntityIds.includes(ent.id)}
                    onChange={() => toggleRelatedEntity(ent.id)}
                  />
                  <span className="loc-form__checkbox-label">
                    <span className="loc-form__checkbox-name">{ent.name}</span>
                    <span className="loc-form__checkbox-type">{ent.type}{ent.role ? ` — ${ent.role}` : ''}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="loc-info__empty">No entities in this case</p>
          )}

          <h4 className="loc-form__section-title" style={{ marginTop: 12 }}>Related Evidence</h4>
          {caseEvidence.length > 0 ? (
            <div className="loc-form__checkbox-list">
              {caseEvidence.map(ev => (
                <label key={ev.id} className="loc-form__checkbox">
                  <input
                    type="checkbox"
                    checked={formData.relatedEvidenceIds.includes(ev.id)}
                    onChange={() => toggleRelatedEvidence(ev.id)}
                  />
                  <span className="loc-form__checkbox-label">
                    <span className="loc-form__checkbox-name">{ev.title}</span>
                    <span className="loc-form__checkbox-type">{ev.type}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="loc-info__empty">No evidence in this case</p>
          )}
        </div>
      </Modal>

      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Location"
        size="sm"
        footer={
          <div className="modal__footer">
            <button className="btn btn--ghost btn--sm" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
            <button className="btn btn--primary btn--sm" style={{ background: '#ef4444' }} onClick={() => handleDelete(deleteConfirmId)}>
              Delete
            </button>
          </div>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Delete this intelligence location? This action cannot be undone.
        </p>
        {deleteConfirmId && (() => {
          const loc = locations.find(l => l.id === deleteConfirmId)
          if (!loc) return null
          return (
            <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13 }}>
              <div><strong>{loc.name}</strong></div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{getLocType(loc)} · {loc.caseId}</div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
