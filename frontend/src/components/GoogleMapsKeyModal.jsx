import { useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { getStoredGoogleMapsApiKey, saveGoogleMapsApiKey, loadGoogleMaps } from '../utils/googleMapsLoader'

export default function GoogleMapsKeyModal({ open, onClose, onKeySaved, onFallbackSelected }) {
  const [apiKey, setApiKey] = useState(() => getStoredGoogleMapsApiKey())
  const [testing, setTesting] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const [showKey, setShowKey] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setApiKey(getStoredGoogleMapsApiKey())
      setStatusMessage(null)
    }
  }

  const handleSave = async () => {
    const trimmed = apiKey.trim()
    if (!trimmed) {
      saveGoogleMapsApiKey('')
      setStatusMessage({ type: 'info', text: 'API key cleared. System will use Tactical Grid Simulation.' })
      if (onKeySaved) onKeySaved('')
      setTimeout(() => onClose(), 800)
      return
    }

    setTesting(true)
    setStatusMessage(null)

    try {
      saveGoogleMapsApiKey(trimmed)
      await loadGoogleMaps(trimmed)
      setStatusMessage({ type: 'success', text: 'Google Maps API loaded successfully!' })
      if (onKeySaved) onKeySaved(trimmed)
      setTimeout(() => {
        setTesting(false)
        onClose()
      }, 1000)
    } catch {
      setTesting(false)
      // Save anyway in case of network throttle or key restrictions
      saveGoogleMapsApiKey(trimmed)
      if (onKeySaved) onKeySaved(trimmed)
      setStatusMessage({
        type: 'warning',
        text: 'Key saved. Note: verify that "Maps JavaScript API" is enabled in your Google Cloud Console project.',
      })
      setTimeout(() => onClose(), 1800)
    }
  }

  const handleFallback = () => {
    if (onFallbackSelected) onFallbackSelected()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Google Maps API Integration"
      size="md"
      footer={
        <div className="modal__footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleFallback}>
            Use Tactical Grid Mode
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleSave}
              disabled={testing}
            >
              {testing ? 'Verifying...' : 'Save & Activate'}
            </button>
          </div>
        </div>
      }
    >
      <div className="google-maps-modal-content">
        <div className="google-maps-banner">
          <div className="google-maps-banner__icon">
            <Icon name="map" className="icon-md" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Google Maps JavaScript API</h4>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Enable live satellite aerial photography, dark tactical mapping, places autocomplete, and reverse geocoding.
            </p>
          </div>
        </div>

        <div className="loc-form__group" style={{ marginTop: 16 }}>
          <label className="loc-form__label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>API Key</span>
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={() => setShowKey(!showKey)}
              style={{ fontSize: 11, padding: '2px 6px', height: 'auto' }}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              className="loc-form__input mono"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ paddingRight: 40 }}
            />
            {apiKey && (
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={() => setApiKey('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                title="Clear key"
              >
                ✕
              </button>
            )}
          </div>
          <span className="loc-form__hint" style={{ fontSize: 11, marginTop: 4 }}>
            Saved locally in your browser storage or configure in <code>frontend/.env</code> as <code>VITE_GOOGLE_MAPS_API_KEY</code>.
          </span>
        </div>

        {statusMessage && (
          <div
            className={`maps-status-badge maps-status-badge--${statusMessage.type}`}
            style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Icon name={statusMessage.type === 'success' ? 'check' : 'shield'} className="icon-xs" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="google-maps-setup-guide" style={{ marginTop: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="help" className="icon-xs" />
            Setup Instructions:
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Go to the <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Google Cloud Console</a>.</li>
            <li>Create a project and enable <strong>Maps JavaScript API</strong>, <strong>Places API</strong>, and <strong>Geocoding API</strong>.</li>
            <li>Generate an API Key under Credentials and paste it above.</li>
          </ol>
        </div>
      </div>
    </Modal>
  )
}
