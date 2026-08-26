import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'

export default function Settings() {
  const { settings, updateSettings, user, showToast } = useApp()
  const [activeTab, setActiveTab] = useState('appearance')

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: 'settings' },
    { id: 'investigation', label: 'Investigation', icon: 'network' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'account', label: 'Account', icon: 'users' },
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
