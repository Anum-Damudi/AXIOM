import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import { getStoredGoogleMapsApiKey, saveGoogleMapsApiKey, loadGoogleMaps } from '../utils/googleMapsLoader'

export default function Settings() {
  const { settings, updateSettings, user, showToast } = useApp()
  const [activeTab, setActiveTab] = useState('appearance')
  const [mapsKey, setMapsKey] = useState(() => getStoredGoogleMapsApiKey())
  const [showMapsKey, setShowMapsKey] = useState(false)
  const [mapsStatus, setMapsStatus] = useState(null)
  const [testingKey, setTestingKey] = useState(false)

  const handleSaveMapsKey = async () => {
    const trimmed = mapsKey.trim()
    setTestingKey(true)
    setMapsStatus(null)

    saveGoogleMapsApiKey(trimmed)
    if (!trimmed) {
      setTestingKey(false)
      setMapsStatus({ type: 'info', message: 'API key cleared. Tactical Grid Simulation will be active.' })
      showToast('Google Maps key cleared', 'info')
      return
    }

    try {
      await loadGoogleMaps(trimmed)
      setTestingKey(false)
      setMapsStatus({ type: 'success', message: 'Google Maps API loaded and verified successfully!' })
      showToast('Google Maps key saved & verified', 'success')
    } catch {
      setTestingKey(false)
      setMapsStatus({
        type: 'warning',
        message: 'Key saved. Please ensure "Maps JavaScript API" & "Places API" are enabled on Google Cloud Console.',
      })
      showToast('Key saved (verification warning)', 'warning')
    }
  }

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: 'settings' },
    { id: 'investigation', label: 'Investigation', icon: 'network' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'account', label: 'Account', icon: 'users' },
    { id: 'integrations', label: 'Integrations', icon: 'globe' },
    { id: 'system', label: 'System', icon: 'shield' },
  ]

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Settings</h2>
          <p className="page-header__desc">Configure platform preferences and system options.</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-tab ${activeTab === tab.id ? 'settings-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon name={tab.icon} className="icon-sm" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {activeTab === 'appearance' && (
            <section className="panel settings-section">
              <h3 className="settings-section__title">Appearance</h3>
              <label className="form-field">
                <span>Theme</span>
                <select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value })}>
                  <option value="dark">Dark (Intelligence Mode)</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={(e) => updateSettings({ compactMode: e.target.checked })}
                />
                <span>Compact mode</span>
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={settings.reduceAnimations}
                  onChange={(e) => updateSettings({ reduceAnimations: e.target.checked })}
                />
                <span>Reduce animations</span>
              </label>
            </section>
          )}

          {activeTab === 'investigation' && (
            <section className="panel settings-section">
              <h3 className="settings-section__title">Investigation Preferences</h3>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={settings.autoAnalyze}
                  onChange={(e) => updateSettings({ autoAnalyze: e.target.checked })}
                />
                <span>Auto-analyze new connections with AI</span>
              </label>
              <label className="form-field">
                <span>Default Risk Threshold</span>
                <select value={settings.riskThreshold} onChange={(e) => updateSettings({ riskThreshold: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={settings.investigationAlerts}
                  onChange={(e) => updateSettings({ investigationAlerts: e.target.checked })}
                />
                <span>Investigation alerts</span>
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={settings.criticalRiskAlerts}
                  onChange={(e) => updateSettings({ criticalRiskAlerts: e.target.checked })}
                />
                <span>Critical risk alerts</span>
              </label>
            </section>
          )}

          {activeTab === 'notifications' && (
            <section className="panel settings-section">
              <h3 className="settings-section__title">Notification Preferences</h3>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={(e) => updateSettings({ emailAlerts: e.target.checked })}
                />
                <span>Email alerts for critical risk events</span>
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={settings.pushAlerts}
                  onChange={(e) => updateSettings({ pushAlerts: e.target.checked })}
                />
                <span>Push notifications for new connections</span>
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={settings.caseUpdates}
                  onChange={(e) => updateSettings({ caseUpdates: e.target.checked })}
                />
                <span>Case update notifications</span>
              </label>
            </section>
          )}

          {activeTab === 'account' && (
            <section className="panel settings-section">
              <h3 className="settings-section__title">Account Information</h3>
              <dl className="detail-dl">
                <div><dt>Name</dt><dd>{user?.displayName || user?.name || 'N/A'}</dd></div>
                <div><dt>Email</dt><dd>{user?.email || 'N/A'}</dd></div>
                <div><dt>Role</dt><dd>{user?.role || 'N/A'}</dd></div>
                <div><dt>Department</dt><dd>{user?.department || 'N/A'}</dd></div>
                <div><dt>Employee ID</dt><dd>{user?.employeeId || 'N/A'}</dd></div>
              </dl>
              <div className="settings-section__actions">
                <button type="button" className="btn btn--ghost" onClick={() => {
                  const newPw = prompt('Enter new password (demo only):')
                  if (newPw) showToast('Password updated successfully', 'success')
                }}>
                  Change Password
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => {
                  const entries = [
                    { time: '10:32 AM', action: 'Logged in from workstation WS-04' },
                    { time: '10:34 AM', action: 'Viewed case NX-2026-147' },
                    { time: '11:15 AM', action: 'Updated evidence EVD-089 metadata' },
                    { time: '12:00 PM', action: 'Exported network graph report' },
                  ]
                  showToast(`${entries.length} recent activity entries loaded`, 'info')
                }}>
                  View Activity Log
                </button>
              </div>
            </section>
          )}

          {activeTab === 'integrations' && (
            <section className="panel settings-section">
              <h3 className="settings-section__title">Geospatial & External Integrations</h3>
              
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="globe" className="icon-sm" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Google Maps JavaScript API</span>
                  </div>
                  <span className={`status-indicator ${mapsKey ? 'status-indicator--online' : ''}`} style={{ fontSize: 12 }}>
                    {mapsKey ? 'Configured' : 'Not Configured (Using Grid Mode)'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                  Powers live satellite imagery, dark tactical street layers, places search autocomplete, and reverse geocoding on the Intelligence Map.
                </p>

                <div className="form-field" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 500 }}>Google Maps API Key</label>
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={() => setShowMapsKey(!showMapsKey)}
                      style={{ fontSize: 11 }}
                    >
                      {showMapsKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showMapsKey ? 'text' : 'password'}
                    className="mono"
                    placeholder="AIzaSy..."
                    value={mapsKey}
                    onChange={(e) => setMapsKey(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Can also be configured in <code>frontend/.env</code> as <code>VITE_GOOGLE_MAPS_API_KEY</code>.
                  </span>
                </div>

                {mapsStatus && (
                  <div
                    className={`maps-status-badge maps-status-badge--${mapsStatus.type}`}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: mapsStatus.type === 'success' ? '#052e16' : mapsStatus.type === 'warning' ? '#451a03' : 'var(--bg-secondary)',
                      color: mapsStatus.type === 'success' ? '#4ade80' : mapsStatus.type === 'warning' ? '#fbbf24' : 'var(--text-primary)',
                      border: `1px solid ${mapsStatus.type === 'success' ? '#166534' : mapsStatus.type === 'warning' ? '#854d0e' : 'var(--border-subtle)'}`,
                    }}
                  >
                    <Icon name={mapsStatus.type === 'success' ? 'check' : 'shield'} className="icon-xs" />
                    <span>{mapsStatus.message}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={handleSaveMapsKey}
                    disabled={testingKey}
                  >
                    {testingKey ? 'Verifying...' : 'Save & Verify API Key'}
                  </button>
                  {mapsKey && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        setMapsKey('')
                        saveGoogleMapsApiKey('')
                        setMapsStatus({ type: 'info', message: 'API key cleared.' })
                      }}
                    >
                      Clear Key
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 20, padding: 14, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                    Google Cloud Console Requirements:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li><strong>Maps JavaScript API:</strong> Required to render map tiles and custom dark styling.</li>
                    <li><strong>Places API:</strong> Enables address autocomplete in the location creation modal.</li>
                    <li><strong>Geocoding API:</strong> Enables reverse geocoding when clicking on the map.</li>
                  </ul>
                  <div style={{ marginTop: 10 }}>
                    <a
                      href="https://console.cloud.google.com/google/maps-apis"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      Open Google Cloud Console →
                    </a>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'system' && (
            <section className="panel settings-section">
              <h3 className="settings-section__title">System Status</h3>
              <dl className="detail-dl">
                <div><dt>Platform</dt><dd>NEXUS-CRIME v1.0</dd></div>
                <div><dt>AI Engine</dt><dd><span className="status-indicator status-indicator--online">Online</span></dd></div>
                <div><dt>Database</dt><dd><span className="status-indicator status-indicator--online">Connected (Local)</span></dd></div>
                <div><dt>Network Graph</dt><dd><span className="status-indicator status-indicator--online">Operational</span></dd></div>
                <div><dt>Last Sync</dt><dd>{new Date().toLocaleString()}</dd></div>
              </dl>
              <div className="system-status system-status--inline">
                <span className="system-status__dot" />
                All systems operational
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
