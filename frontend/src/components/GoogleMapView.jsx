import { useEffect, useRef, useState, useCallback } from 'react'
import Icon from './Icon'
import { DARK_TACTICAL_STYLE, CYBER_TACTICAL_STYLE } from '../utils/googleMapsStyles'
import { loadGoogleMaps, onGoogleMapsAuthError } from '../utils/googleMapsLoader'

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

function createPinSvg(color, isSelected = false) {
  const size = isSelected ? 40 : 32
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 10}" viewBox="0 0 32 42">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${color}" flood-opacity="0.6"/>
        </filter>
      </defs>
      <path d="M16 0 C7.16 0 0 7.16 0 16 C0 26 16 42 16 42 C16 42 32 26 32 16 C32 7.16 24.84 0 16 0 Z" 
            fill="#0f172a" stroke="${color}" stroke-width="${isSelected ? 3 : 2}" filter="url(#glow)"/>
      <circle cx="16" cy="16" r="6.5" fill="${color}" />
      ${isSelected ? `<circle cx="16" cy="16" r="10" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3,2"/>` : ''}
    </svg>
  `
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

function createPreviewPinSvg() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 32 42">
      <defs>
        <filter id="preview-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#22c55e" flood-opacity="0.8"/>
        </filter>
      </defs>
      <path d="M16 0 C7.16 0 0 7.16 0 16 C0 26 16 42 16 42 C16 42 32 26 32 16 C32 7.16 24.84 0 16 0 Z" 
            fill="#0f172a" stroke="#22c55e" stroke-width="3" filter="url(#preview-glow)"/>
      <circle cx="16" cy="16" r="7" fill="#22c55e" />
      <path d="M16 10 L16 22 M10 16 L22 16" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

export default function GoogleMapView({
  locations = [],
  selectedLoc = null,
  onSelectLoc,
  selectingOnMap = false,
  onMapClick,
  previewCoords = null,
  activeCaseId = '',
  onOpenKeyModal,
  onSwitchToGrid,
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef(new Map())
  const previewMarkerRef = useRef(null)
  const infoWindowRef = useRef(null)
  const polylineRef = useRef(null)
  const heatmapRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [mapStyle, setMapStyle] = useState('tactical')
  const [showTrajectories, setShowTrajectories] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(false)

  // Listen for auth failure from Google
  useEffect(() => {
    const unsub = onGoogleMapsAuthError(() => {
      setLoadError('Google Maps API authentication failed (check API key restrictions or billing).')
      setLoading(false)
    })
    return unsub
  }, [])

  // Initialize Map
  useEffect(() => {
    let isMounted = true

    loadGoogleMaps()
      .then((googleMaps) => {
        if (!isMounted || !mapContainerRef.current) return

        // Default center (India/Mumbai/Chennai default bounding)
        const defaultCenter = { lat: 18.9220, lng: 72.8340 }

        const map = new googleMaps.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 12,
          styles: DARK_TACTICAL_STYLE,
          mapTypeId: 'roadmap',
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: googleMaps.ControlPosition.RIGHT_BOTTOM,
          },
          mapTypeControl: false,
          streetViewControl: true,
          streetViewControlOptions: {
            position: googleMaps.ControlPosition.RIGHT_BOTTOM,
          },
          fullscreenControl: false,
          gestureHandling: 'greedy',
        })

        infoWindowRef.current = new googleMaps.InfoWindow()
        mapInstanceRef.current = map

        setLoading(false)
      })
      .catch((err) => {
        if (!isMounted) return
        setLoading(false)
        if (err.message === 'NO_API_KEY') {
          setLoadError('NO_API_KEY')
        } else {
          setLoadError(err.message || 'Failed to load Google Maps API')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Handle map style changes
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps) return

    if (mapStyle === 'tactical') {
      map.setMapTypeId('roadmap')
      map.setOptions({ styles: DARK_TACTICAL_STYLE })
    } else if (mapStyle === 'cyber') {
      map.setMapTypeId('roadmap')
      map.setOptions({ styles: CYBER_TACTICAL_STYLE })
    } else if (mapStyle === 'satellite') {
      map.setMapTypeId('satellite')
      map.setOptions({ styles: null })
    } else if (mapStyle === 'hybrid') {
      map.setMapTypeId('hybrid')
      map.setOptions({ styles: null })
    } else if (mapStyle === 'roadmap') {
      map.setMapTypeId('roadmap')
      map.setOptions({ styles: null })
    }
  }, [mapStyle])

  // Handle Map Clicks (Coordinates picking / geocoding)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps) return

    map.setOptions({
      draggableCursor: selectingOnMap ? 'crosshair' : null,
      draggingCursor: selectingOnMap ? 'crosshair' : null,
    })

    const clickListener = map.addListener('click', (e) => {
      if (!e.latLng) return
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()

      if (selectingOnMap) {
        // Reverse Geocode to resolve human address
        if (window.google.maps.Geocoder) {
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            let address = ''
            if (status === 'OK' && results && results[0]) {
              address = results[0].formatted_address
            }
            if (onMapClick) onMapClick(lat, lng, address)
          })
        } else {
          if (onMapClick) onMapClick(lat, lng, '')
        }
      } else {
        // Close InfoWindow if clicking empty map
        if (infoWindowRef.current) infoWindowRef.current.close()
        if (onSelectLoc) onSelectLoc(null)
      }
    })

    return () => {
      window.google.maps.event.removeListener(clickListener)
    }
  }, [selectingOnMap, onMapClick, onSelectLoc])

  // Update Preview Marker (during "Select on Map")
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps) return

    if (previewCoords && previewCoords.lat != null && previewCoords.lng != null) {
      const pos = { lat: previewCoords.lat, lng: previewCoords.lng }
      if (!previewMarkerRef.current) {
        previewMarkerRef.current = new window.google.maps.Marker({
          position: pos,
          map,
          draggable: true,
          icon: {
            url: createPreviewPinSvg(),
            scaledSize: new window.google.maps.Size(38, 48),
            anchor: new window.google.maps.Point(19, 48),
          },
          title: 'Selected Coordinate',
          zIndex: 9999,
        })

        previewMarkerRef.current.addListener('dragend', (e) => {
          if (e.latLng && onMapClick) {
            const lat = e.latLng.lat()
            const lng = e.latLng.lng()
            if (window.google.maps.Geocoder) {
              const geocoder = new window.google.maps.Geocoder()
              geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                const address = (status === 'OK' && results?.[0]) ? results[0].formatted_address : ''
                onMapClick(lat, lng, address)
              })
            } else {
              onMapClick(lat, lng, '')
            }
          }
        })
      } else {
        previewMarkerRef.current.setPosition(pos)
        previewMarkerRef.current.setMap(map)
      }
    } else {
      if (previewMarkerRef.current) {
        previewMarkerRef.current.setMap(null)
        previewMarkerRef.current = null
      }
    }
  }, [previewCoords, onMapClick])

  // Render Markers
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps) return

    const currentMarkers = markersRef.current
    const validLocs = locations.filter(l => l.latitude != null && l.longitude != null)
    const validIds = new Set(validLocs.map(l => l.id))

    // Remove markers that no longer exist
    for (const [id, marker] of currentMarkers.entries()) {
      if (!validIds.has(id)) {
        marker.setMap(null)
        currentMarkers.delete(id)
      }
    }

    // Add or update markers
    validLocs.forEach((loc) => {
      const pos = { lat: loc.latitude, lng: loc.longitude }
      const lType = loc.type || loc.locationType || 'Other'
      const color = TYPE_COLORS[lType] || TYPE_COLORS['Other']
      const isSelected = selectedLoc?.id === loc.id

      let marker = currentMarkers.get(loc.id)

      if (!marker) {
        marker = new window.google.maps.Marker({
          position: pos,
          map,
          title: loc.name,
          icon: {
            url: createPinSvg(color, isSelected),
            scaledSize: isSelected ? new window.google.maps.Size(40, 50) : new window.google.maps.Size(32, 42),
            anchor: isSelected ? new window.google.maps.Point(20, 50) : new window.google.maps.Point(16, 42),
          },
          zIndex: isSelected ? 100 : 10,
        })

        marker.addListener('click', () => {
          if (onSelectLoc) onSelectLoc(loc)

          // Show tactical InfoWindow
          if (infoWindowRef.current) {
            const content = `
              <div class="google-infowindow" style="color: #0f172a; padding: 4px; font-family: Inter, sans-serif;">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${loc.name}</div>
                <div style="display: inline-block; background: ${color}20; color: ${color}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-bottom: 6px;">
                  ${lType}
                </div>
                ${loc.address ? `<div style="font-size: 11px; color: #475569; margin-bottom: 4px;">📍 ${loc.address}</div>` : ''}
                <div style="font-size: 11px; color: #64748b; font-family: monospace;">${loc.latitude.toFixed(4)}°, ${loc.longitude.toFixed(4)}°</div>
              </div>
            `
            infoWindowRef.current.setContent(content)
            infoWindowRef.current.open(map, marker)
          }
        })

        currentMarkers.set(loc.id, marker)
      } else {
        marker.setPosition(pos)
        marker.setIcon({
          url: createPinSvg(color, isSelected),
          scaledSize: isSelected ? new window.google.maps.Size(40, 50) : new window.google.maps.Size(32, 42),
          anchor: isSelected ? new window.google.maps.Point(20, 50) : new window.google.maps.Point(16, 42),
        })
        marker.setZIndex(isSelected ? 100 : 10)
      }
    })
  }, [locations, selectedLoc, onSelectLoc])

  // Fit bounds when activeCaseId changes or locations change
  const handleFitBounds = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps) return

    const validLocs = locations.filter(l => l.latitude != null && l.longitude != null)
    if (validLocs.length === 0) return

    const bounds = new window.google.maps.LatLngBounds()
    validLocs.forEach(l => bounds.extend({ lat: l.latitude, lng: l.longitude }))

    map.fitBounds(bounds)
    // Avoid over-zooming on single location
    if (validLocs.length === 1) {
      setTimeout(() => {
        if (map.getZoom() > 15) map.setZoom(14)
      }, 100)
    }
  }, [locations])

  // Center on selected location if chosen
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !selectedLoc || selectedLoc.latitude == null || selectedLoc.longitude == null) return
    map.panTo({ lat: selectedLoc.latitude, lng: selectedLoc.longitude })
  }, [selectedLoc])

  // Automatically fit bounds when active case changes
  useEffect(() => {
    if (locations.length > 0) {
      handleFitBounds()
    }
  }, [activeCaseId, handleFitBounds, locations.length])

  // Surveillance Trajectory / Polyline Path
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps) return

    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    if (!showTrajectories) return

    // Find sequence of vehicle or movement locations
    const validLocs = locations
      .filter(l => l.latitude != null && l.longitude != null)
      .sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0))

    if (validLocs.length < 2) return

    const path = validLocs.map(l => ({ lat: l.latitude, lng: l.longitude }))

    polylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#06b6d4',
      strokeOpacity: 0.8,
      strokeWeight: 3,
      map,
      icons: [
        {
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            strokeColor: '#06b6d4',
          },
          offset: '50%',
          repeat: '100px',
        },
      ],
    })

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
        polylineRef.current = null
      }
    }
  }, [locations, showTrajectories])

  // Hotspot Activity Heatmap
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps?.visualization) return

    if (heatmapRef.current) {
      heatmapRef.current.setMap(null)
      heatmapRef.current = null
    }

    if (!showHeatmap) return

    const heatmapData = locations
      .filter(l => l.latitude != null && l.longitude != null)
      .map(l => new window.google.maps.LatLng(l.latitude, l.longitude))

    if (heatmapData.length === 0) return

    heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      radius: 35,
      opacity: 0.7,
      gradient: [
        'rgba(0, 255, 255, 0)',
        'rgba(0, 255, 255, 1)',
        'rgba(59, 130, 246, 1)',
        'rgba(245, 158, 11, 1)',
        'rgba(239, 68, 68, 1)',
      ],
      map,
    })

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null)
        heatmapRef.current = null
      }
    }
  }, [locations, showHeatmap])

  const toggleFullscreen = () => {
    const container = mapContainerRef.current?.parentElement
    if (!container) return

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  return (
    <div className="google-map-wrapper panel" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 520, overflow: 'hidden' }}>
      {/* Map Header Toolbar */}
      <div className="google-map-toolbar">
        <div className="google-map-toolbar__group">
          <select
            className="google-map-select"
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            title="Map Layer Style"
          >
            <option value="tactical">Dark Tactical (Cyber)</option>
            <option value="cyber">Cyber Neon</option>
            <option value="satellite">Satellite Imagery</option>
            <option value="hybrid">Hybrid Aerial</option>
            <option value="roadmap">Standard Street</option>
          </select>

          <button
            type="button"
            className={`btn btn--xs ${showTrajectories ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setShowTrajectories(!showTrajectories)}
            title="Toggle Surveillance Route Vectors"
          >
            <Icon name="network" className="icon-xs" /> Trajectory
          </button>

          <button
            type="button"
            className={`btn btn--xs ${showHeatmap ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setShowHeatmap(!showHeatmap)}
            title="Toggle Hotspot Density Heatmap"
          >
            <Icon name="shield" className="icon-xs" /> Heatmap
          </button>
        </div>

        <div className="google-map-toolbar__group">
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={handleFitBounds}
            title="Fit All Locations in View"
          >
            <Icon name="map" className="icon-xs" /> Fit Bounds
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={onOpenKeyModal}
            title="Configure Google Maps API Key"
          >
            <Icon name="settings" className="icon-xs" /> API Key
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen View"
          >
            <Icon name="expand" className="icon-xs" />
          </button>
        </div>
      </div>

      {/* Main Map Container */}
      <div
        ref={mapContainerRef}
        className="google-map-canvas"
        style={{ width: '100%', height: '100%', minHeight: 520 }}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="google-map-overlay-message">
          <div className="spinner" />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading Google Maps Intelligence Layer...</span>
        </div>
      )}

      {/* Error or Missing Key Banner */}
      {loadError && (
        <div className="google-map-overlay-message google-map-overlay-message--error">
          <Icon name="shield" className="icon-lg" style={{ color: '#f59e0b' }} />
          <h3 style={{ margin: '8px 0 4px', fontSize: 16 }}>Google Maps API Key Required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460, textAlign: 'center' }}>
            {loadError === 'NO_API_KEY'
              ? 'To view live satellite aerials, tactical dark tiles, and places geocoding, please enter your Google Maps API key.'
              : `Map error: ${loadError}. Please verify your API key and enabled APIs.`}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn--primary btn--sm" onClick={onOpenKeyModal}>
              <Icon name="settings" className="icon-xs" /> Enter API Key
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onSwitchToGrid}>
              Use Tactical Grid Simulation
            </button>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="google-map-legend">
        <div className="google-map-legend__title">Intel Legend</div>
        <div className="google-map-legend__grid">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="google-map-legend__item">
              <span className="google-map-legend__dot" style={{ backgroundColor: color }} />
              <span className="google-map-legend__label">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
