// Google Maps Custom Styling Configurations for AXIOM Intelligence Platform

export const DARK_TACTICAL_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1120' }, { weight: 2 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }, { weight: 1.5 }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#131e36' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0e232c' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }, { opacity: 0.7 }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#192642' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#061322' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }, { opacity: 0.6 }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#061322' }],
  },
]

export const CYBER_TACTICAL_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#070d18' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#050912' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#38bdf8' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#112238' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#0ea5e9' }, { lightness: -40 }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#030814' }],
  },
]

export const MAP_TYPE_OPTIONS = [
  { id: 'tactical', label: 'Dark Tactical', icon: 'shield' },
  { id: 'satellite', label: 'Satellite Imagery', icon: 'eye' },
  { id: 'hybrid', label: 'Hybrid Aerial', icon: 'globe' },
  { id: 'roadmap', label: 'Standard Road', icon: 'map' },
]
