import { useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import FormSection from './forms/FormSection'
import FormField from './forms/FormField'
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
      <FormSection title="Map Provider" subtitle="Enable live maps, Places autocomplete, and reverse geocoding">

        <div className="mt-4">
          <div className="mb-1.5 flex justify-end">
            <button type="button" className="btn btn--ghost btn--xs" onClick={() => setShowKey(!showKey)}>
              {showKey ? 'Hide key' : 'Show key'}
            </button>
          </div>
          <FormField
            label="API Key"
            hint="Saved locally, or configured in frontend/.env as VITE_GOOGLE_MAPS_API_KEY"
          >
            <input
              type={showKey ? 'text' : 'password'}
              className="mono"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </FormField>
          {apiKey && (
            <button type="button" className="btn btn--ghost btn--xs mt-2" onClick={() => setApiKey('')}>
              Clear key
            </button>
          )}
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
      </FormSection>
    </Modal>
  )
}
