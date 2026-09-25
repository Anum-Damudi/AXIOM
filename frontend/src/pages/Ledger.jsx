import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'

export default function Ledger() {
  const { 
    getLedgerSummary, 
    getLedgerBlocks, 
    getLedgerEntries, 
    verifyChain, 
    sealLedgerBlock,
    selectedCaseId,
    cases,
    setSelectedCaseId,
    showToast 
  } = useApp()

  const [summary, setSummary] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [chainStatus, setChainStatus] = useState(null)
  const [sealing, setSealing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const loadLedgerData = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryData, blocksData, entriesData] = await Promise.all([
        getLedgerSummary(),
        getLedgerBlocks(),
        getLedgerEntries(selectedCaseId)
      ])
      setSummary(summaryData)
      setBlocks(blocksData || [])
      setEntries(entriesData || [])
    } catch (e) {
      console.error('Failed to load ledger data:', e)
      showToast('Failed to load ledger data', 'error')
    } finally {
      setLoading(false)
    }
  }, [getLedgerBlocks, getLedgerEntries, getLedgerSummary, selectedCaseId, showToast])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      loadLedgerData()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [loadLedgerData])

  const handleVerifyChain = async () => {
    setVerifying(true)
    try {
      const result = await verifyChain()
      setChainStatus(result)
      if (result?.valid) {
        showToast('Blockchain integrity verified: chain is valid')
      } else {
        showToast(`Blockchain integrity issue detected at block ${result?.broken_at}`, 'error')
      }
    } catch {
      showToast('Chain verification failed', 'error')
    } finally {
      setVerifying(false)
    }
  }

  const handleSealBlock = async () => {
    setSealing(true)
    try {
      const result = await sealLedgerBlock()
      if (result) {
        showToast('Block sealed successfully')
        await loadLedgerData()
      }
    } catch {
      showToast('Failed to seal block', 'error')
    } finally {
      setSealing(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString()
  }

  const formatHash = (hash) => {
    if (!hash) return '—'
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`
  }

  return (
    <div className="page page--ledger">
      <div className="page__header">
        <h1 className="page__title">Evidence Ledger</h1>
        <p className="page__subtitle">Immutable blockchain evidence integrity tracking</p>
        <div className="page__header__actions">
          <select 
            className="toolbar__select" 
            value={selectedCaseId || ''} 
            onChange={e => setSelectedCaseId(e.target.value || null)}
          >
            <option value="">All Cases</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
          </select>
          <button 
            className="btn btn--ghost" 
            onClick={handleVerifyChain}
            disabled={verifying}
          >
            <Icon name="shield" className="icon-xs" />
            {verifying ? ' Verifying...' : ' Verify Chain'}
          </button>
          <button 
            className="btn btn--primary" 
            onClick={handleSealBlock}
            disabled={sealing}
          >
            <Icon name="lock" className="icon-xs" />
            {sealing ? ' Sealing...' : ' Seal Block'}
          </button>
        </div>
      </div>

      <div className="page__content">
        {loading ? (
          <div className="empty-state">
            <Icon name="loader" className="icon-xl spin" />
            <p>Loading ledger data...</p>
          </div>
        ) : (
          <>
            {summary && (
              <div className="panel" style={{ marginBottom: '1rem' }}>
                <header className="panel__header">
                  <h3 className="panel__title">Ledger Summary</h3>
                </header>
                <div className="panel__body">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-card__value">{summary.total_blocks || 0}</div>
                      <div className="stat-card__label">Total Blocks</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card__value">{summary.total_entries || 0}</div>
                      <div className="stat-card__label">Total Entries</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card__value">
                        {summary.chain_valid ? (
                          <span style={{ color: 'var(--success-color, #10b981)' }}>Valid</span>
                        ) : (
                          <span style={{ color: 'var(--error-color, #ef4444)' }}>Broken</span>
                        )}
                      </div>
                      <div className="stat-card__label">Chain Status</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card__value" style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {formatHash(summary.latest_block_hash)}
                      </div>
                      <div className="stat-card__label">Latest Hash</div>
                    </div>
                  </div>

                  {chainStatus && (
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '0.75rem', 
                      borderRadius: '6px',
                      background: chainStatus.valid ? 'var(--success-bg, rgba(16, 185, 129, 0.1))' : 'var(--error-bg, rgba(239, 68, 68, 0.1))',
                      border: `1px solid ${chainStatus.valid ? 'var(--success-color, #10b981)' : 'var(--error-color, #ef4444)'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Icon name={chainStatus.valid ? 'check' : 'alert'} className="icon-sm" />
                        <strong>{chainStatus.valid ? 'Chain Verified' : 'Chain Integrity Issue'}</strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        {chainStatus.valid ? chainStatus.message : `Broken at block ${chainStatus.broken_at}: ${chainStatus.message}`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'blocks' ? 'tab--active' : ''}`}
                onClick={() => setActiveTab('blocks')}
              >
                Blocks ({blocks.length})
              </button>
              <button 
                className={`tab ${activeTab === 'entries' ? 'tab--active' : ''}`}
                onClick={() => setActiveTab('entries')}
              >
                Entries ({entries.length})
              </button>
            </div>

            {activeTab === 'blocks' && (
              <div className="panel">
                <header className="panel__header">
                  <h3 className="panel__title">Blockchain Blocks</h3>
                </header>
                <div className="panel__body">
                  {blocks.length === 0 ? (
                    <div className="empty-state">
                      <Icon name="cube" className="icon-lg" />
                      <p>No blocks found. Seal entries to create blocks.</p>
                    </div>
                  ) : (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Index</th>
                            <th>Block Hash</th>
                            <th>Previous Hash</th>
                            <th>Merkle Root</th>
                            <th>Entries</th>
                            <th>Sealed At</th>
                            <th>Sealed By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {blocks.map(block => (
                            <tr key={block.id}>
                              <td>{block.index}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                {formatHash(block.block_hash)}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                {formatHash(block.previous_hash)}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                {formatHash(block.merkle_root)}
                              </td>
                              <td>{block.entry_count || 0}</td>
                              <td>{formatDate(block.sealed_at)}</td>
                              <td>{block.sealed_by || 'system'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'entries' && (
              <div className="panel">
                <header className="panel__header">
                  <h3 className="panel__title">Ledger Entries</h3>
                </header>
                <div className="panel__body">
                  {entries.length === 0 ? (
                    <div className="empty-state">
                      <Icon name="file" className="icon-lg" />
                      <p>No entries found. Entries are created when evidence is added or custody is transferred.</p>
                    </div>
                  ) : (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Entry ID</th>
                            <th>Type</th>
                            <th>Case ID</th>
                            <th>Evidence ID</th>
                            <th>Actor</th>
                            <th>Created At</th>
                            <th>Block</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map(entry => (
                            <tr key={entry.id}>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                {formatHash(entry.id)}
                              </td>
                              <td>
                                <span className={`status-badge status-badge--${entry.entry_type?.toLowerCase() || 'pending'}`}>
                                  {entry.entry_type}
                                </span>
                              </td>
                              <td>{entry.case_id || '—'}</td>
                              <td>{entry.evidence_id || '—'}</td>
                              <td>{entry.actor_id || '—'}</td>
                              <td>{formatDate(entry.created_at)}</td>
                              <td>
                                {entry.block_id ? (
                                  <span style={{ color: 'var(--success-color, #10b981)' }}>
                                    ✓ {entry.block_id}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted, #888)' }}>
                                    Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
