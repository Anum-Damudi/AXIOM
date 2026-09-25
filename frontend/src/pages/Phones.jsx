import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import MetricGrid from '../components/ui/MetricGrid'
import FormSection from '../components/forms/FormSection'
import FormField from '../components/forms/FormField'

export default function Phones() {
  const { selectedCaseId, cases, setSelectedCaseId, importCDR, getPhoneIntelligence, showToast } = useApp()
  
  const [showImportForm, setShowImportForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [operator, setOperator] = useState('')
  const [phoneIntelligence, setPhoneIntelligence] = useState(null)
  const [loadingIntelligence, setLoadingIntelligence] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const loadPhoneIntelligence = useCallback(async () => {
    if (!selectedCaseId) return
    setLoadingIntelligence(true)
    try {
      const data = await getPhoneIntelligence(selectedCaseId)
      setPhoneIntelligence(data)
    } catch (e) {
      console.error('Failed to load phone intelligence:', e)
    } finally {
      setLoadingIntelligence(false)
    }
  }, [selectedCaseId, getPhoneIntelligence])

  useEffect(() => {
    if (!selectedCaseId) return
    const frame = window.requestAnimationFrame(() => {
      loadPhoneIntelligence()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedCaseId, loadPhoneIntelligence])

  const handleImport = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      showToast('Please select a CSV file', 'error')
      return
    }
    if (!selectedCaseId) {
      showToast('Please select a case first', 'error')
      return
    }

    setImporting(true)
    try {
      const result = await importCDR(selectedCaseId, selectedFile, operator)
      if (result) {
        showToast('CDR data imported successfully')
        setSelectedFile(null)
        setOperator('')
        setShowImportForm(false)
        await loadPhoneIntelligence()
      }
    } catch {
      showToast('CDR import failed', 'error')
    } finally {
      setImporting(false)
    }
  }

  if (!selectedCaseId) {
    return (
      <div className="page page--phones">
        <div className="page__header">
          <h1 className="page__title">Phone Intelligence</h1>
          <p className="page__subtitle">CDR analysis, movement tracking, and network detection</p>
        </div>

        <div className="page__content">
          <div className="empty-state">
            <Icon name="phone" className="icon-xl" />
            <h2>Select a Case</h2>
            <p>Please select a case to analyze phone intelligence data.</p>
            <div className="empty-state__actions">
              <select 
                className="toolbar__select" 
                value={selectedCaseId || ''} 
                onChange={e => setSelectedCaseId(e.target.value || null)}
              >
                <option value="">Select Case</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--phones">
      <div className="page__header">
        <h1 className="page__title">Phone Intelligence</h1>
        <p className="page__subtitle">CDR analysis, movement tracking, and network detection</p>
        <div className="page__header__actions">
          <select 
            className="toolbar__select" 
            value={selectedCaseId || ''} 
            onChange={e => setSelectedCaseId(e.target.value || null)}
          >
            <option value="">Select Case</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
          </select>
          <button 
            className="btn btn--primary" 
            onClick={() => setShowImportForm(!showImportForm)}
          >
            <Icon name="upload" className="icon-xs" /> Import CDR Data
          </button>
        </div>
      </div>

      <div className="page__content">
        {showImportForm && (
          <section className="panel">
            <header className="panel__header">
              <div>
                <h3 className="panel__title">Import CDR Data</h3>
                <p className="panel__subtitle">Upload Call Detail Records (CSV) for analysis</p>
              </div>
            </header>
            <div className="panel__body">
              <form onSubmit={handleImport} className="space-y-4">
                <FormSection title="CDR Source" subtitle="Upload the call detail record file and identify its operator">
                  <FormField label="CSV File" required full hint="Required columns: caller_number, called_number, start_time">
                    <div className="file-upload-wrapper">
                      <input
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                        accept=".csv"
                        className="file-upload-input"
                      />
                      {selectedFile && (
                        <div className="file-upload-info">
                          <Icon name="file" className="icon-sm" />
                          <span>{selectedFile.name}</span>
                          <span className="file-upload-size">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                          <button type="button" className="btn btn--ghost btn--xs" onClick={() => setSelectedFile(null)}>
                            <Icon name="x" className="icon-xs" />
                          </button>
                        </div>
                      )}
                    </div>
                  </FormField>
                  <FormField label="Operator" hint="Optional when the source metadata is not available">
                    <input
                      type="text"
                      value={operator}
                      onChange={e => setOperator(e.target.value)}
                      placeholder="e.g. JIO, Airtel, Vodafone"
                    />
                  </FormField>
                </FormSection>
                <div className="form-actions">
                  <button type="button" className="btn btn--ghost" onClick={() => setShowImportForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn--primary" disabled={importing || !selectedFile}>
                    {importing ? <Icon name="loader" className="icon-sm spin" /> : <Icon name="upload" className="icon-sm" />}
                    {importing ? ' Importing...' : ' Import CDR'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {loadingIntelligence ? (
          <div className="empty-state">
            <Icon name="loader" className="icon-xl spin" />
            <p>Loading phone intelligence data...</p>
          </div>
        ) : !phoneIntelligence ? (
          <div className="empty-state">
            <Icon name="phone" className="icon-xl" />
            <h2>No CDR Data Imported</h2>
            <p>Import CDR data to analyze phone networks, movement patterns, and detect burner phones.</p>
            <div className="empty-state__actions">
              <button className="btn btn--primary" onClick={() => setShowImportForm(true)}>
                <Icon name="upload" className="icon-xs" /> Import CDR Data
              </button>
            </div>
          </div>
        ) : (
          <div className="phone-intelligence">
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'overview' ? 'tab--active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`tab ${activeTab === 'network' ? 'tab--active' : ''}`}
                onClick={() => setActiveTab('network')}
              >
                Network Analysis
              </button>
              <button 
                className={`tab ${activeTab === 'burners' ? 'tab--active' : ''}`}
                onClick={() => setActiveTab('burners')}
              >
                Burner Detection
              </button>
              <button 
                className={`tab ${activeTab === 'movement' ? 'tab--active' : ''}`}
                onClick={() => setActiveTab('movement')}
              >
                Movement Patterns
              </button>
            </div>

            {activeTab === 'overview' && (
              <div className="panel">
                <header className="panel__header">
                  <h3 className="panel__title">CDR Import Summary</h3>
                </header>
                <div className="panel__body">
                  <MetricGrid
                    ariaLabel="CDR import metrics"
                    items={[
                      { id: 'records', label: 'Total Records', value: phoneIntelligence.summary?.total_records || 0, icon: 'file' },
                      { id: 'valid-records', label: 'Valid Records', value: phoneIntelligence.summary?.valid_records || 0, icon: 'check' },
                      { id: 'numbers', label: 'Unique Numbers', value: phoneIntelligence.summary?.unique_numbers || 0, icon: 'phone' },
                      { id: 'imports', label: 'CDR Imports', value: phoneIntelligence.summary?.total_imports || 0, icon: 'upload' },
                    ]}
                  />

                  {phoneIntelligence.summary?.date_range_start && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary, rgba(255,255,255,0.03))', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>Date Range</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                        {new Date(phoneIntelligence.summary.date_range_start).toLocaleDateString()} — {new Date(phoneIntelligence.summary.date_range_end).toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {phoneIntelligence.imports && phoneIntelligence.imports.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <h4 style={{ marginBottom: '0.5rem' }}>Import History</h4>
                      <div className="data-table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Import ID</th>
                              <th>Source File</th>
                              <th>Operator</th>
                              <th>Records</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {phoneIntelligence.imports.map(imp => (
                              <tr key={imp.id}>
                                <td>{imp.id}</td>
                                <td>{imp.source_file}</td>
                                <td>{imp.operator || '—'}</td>
                                <td>{imp.valid_records || imp.total_records}</td>
                                <td>
                                  <span className={`status-badge status-badge--${imp.status?.toLowerCase() || 'pending'}`}>
                                    {imp.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'network' && (
              <div className="panel">
                <header className="panel__header">
                  <h3 className="panel__title">Network Analysis</h3>
                </header>
                <div className="panel__body">
                  <h4>Top Connected Numbers</h4>
                  {phoneIntelligence.top_connected_numbers && phoneIntelligence.top_connected_numbers.length > 0 ? (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Phone Number</th>
                            <th>Total Calls</th>
                            <th>Outgoing</th>
                            <th>Incoming</th>
                            <th>Unique Contacts</th>
                            <th>Total Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phoneIntelligence.top_connected_numbers.map((phone, idx) => (
                            <tr key={idx}>
                              <td>{phone.number}</td>
                              <td>{phone.total_calls}</td>
                              <td>{phone.outgoing}</td>
                              <td>{phone.incoming}</td>
                              <td>{phone.unique_contacts}</td>
                              <td>{Math.floor(phone.total_duration / 60)}m {phone.total_duration % 60}s</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted, #888)' }}>No network data available</p>
                  )}

                  <h4 style={{ marginTop: '1.5rem' }}>Frequent Communication Pairs</h4>
                  {phoneIntelligence.frequent_pairs && phoneIntelligence.frequent_pairs.length > 0 ? (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Caller</th>
                            <th>Called</th>
                            <th>Call Count</th>
                            <th>Total Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phoneIntelligence.frequent_pairs.map((pair, idx) => (
                            <tr key={idx}>
                              <td>{pair.caller}</td>
                              <td>{pair.called}</td>
                              <td>{pair.count}</td>
                              <td>{Math.floor(pair.total_duration / 60)}m {pair.total_duration % 60}s</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted, #888)' }}>No pair data available</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'burners' && (
              <div className="panel">
                <header className="panel__header">
                  <h3 className="panel__title">Burner Phone Detection</h3>
                </header>
                <div className="panel__body">
                  {phoneIntelligence.burner_indicators && phoneIntelligence.burner_indicators.length > 0 ? (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Phone Number</th>
                            <th>Confidence</th>
                            <th>Total Calls</th>
                            <th>Contacts</th>
                            <th>Indicators</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phoneIntelligence.burner_indicators.map((burner, idx) => (
                            <tr key={idx}>
                              <td>{burner.phone_number}</td>
                              <td>
                                <span className={`status-badge ${burner.confidence >= 0.7 ? 'status-badge--high' : burner.confidence >= 0.5 ? 'status-badge--medium' : 'status-badge--low'}`}>
                                  {Math.round(burner.confidence * 100)}%
                                </span>
                              </td>
                              <td>{burner.total_calls}</td>
                              <td>{burner.contacts_count}</td>
                              <td>
                                <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem' }}>
                                  {burner.signals.map((signal, sIdx) => (
                                    <li key={sIdx}>{signal}</li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Icon name="shield" className="icon-lg" />
                      <p>No potential burner phones detected</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'movement' && (
              <div className="panel">
                <header className="panel__header">
                  <h3 className="panel__title">Movement Patterns</h3>
                </header>
                <div className="panel__body">
                  <h4>Cell Tower Analysis</h4>
                  {phoneIntelligence.tower_analysis && phoneIntelligence.tower_analysis.length > 0 ? (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Tower ID</th>
                            <th>Location</th>
                            <th>Call Count</th>
                            <th>Unique Numbers</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phoneIntelligence.tower_analysis.map((tower, idx) => (
                            <tr key={idx}>
                              <td>{tower.tower_id}</td>
                              <td>
                                {tower.latitude && tower.longitude ? (
                                  <span style={{ fontSize: '0.85rem' }}>
                                    {tower.latitude.toFixed(4)}, {tower.longitude.toFixed(4)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td>{tower.call_count}</td>
                              <td>{tower.unique_numbers_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted, #888)' }}>No tower data available</p>
                  )}

                  <h4 style={{ marginTop: '1.5rem' }}>Call Time Patterns</h4>
                  {phoneIntelligence.time_patterns && (
                    <div style={{ display: 'flex', gap: '0.25rem', height: '100px', alignItems: 'flex-end' }}>
                      {phoneIntelligence.time_patterns.map((hour, idx) => (
                        <div
                          key={idx}
                          style={{
                            flex: 1,
                            background: `var(--accent-primary, #4f46e5)`,
                            height: `${Math.max(5, (hour.count / Math.max(...phoneIntelligence.time_patterns.map(h => h.count))) * 100)}%`,
                            borderRadius: '2px',
                            position: 'relative'
                          }}
                          title={`Hour ${hour.hour}: ${hour.count} calls`}
                        >
                          <span style={{ 
                            position: 'absolute', 
                            bottom: '-20px', 
                            left: '50%', 
                            transform: 'translateX(-50%)', 
                            fontSize: '0.7rem',
                            color: 'var(--text-muted, #888)'
                          }}>
                            {hour.hour}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
