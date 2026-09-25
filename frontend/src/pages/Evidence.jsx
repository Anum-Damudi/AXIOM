import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import Drawer from '../components/Drawer'
import Icon from '../components/Icon'
import CustodyTimeline from '../components/CustodyTimeline'
import EvidenceUploader from '../components/EvidenceUploader'
import FormSection from '../components/forms/FormSection'
import FormField from '../components/forms/FormField'
const EVIDENCE_TYPES = [
  'Document',
  'Communication Record',
  'Financial Record',
  'Location Record',
  'Digital Evidence',
  'Observation',
  'Photograph/Media',
  'Other',
]
const EVIDENCE_STATUSES = ['Pending', 'Under Review', 'Verified', 'Archived']
const EVIDENCE_CATEGORIES = ['All', ...EVIDENCE_TYPES]
function todayISO() {
  return new Date().toISOString().split('T')[0]
}
export default function Evidence() {
  const {
    evidence,
    entities,
    cases,
    selectedCaseId,
    setSelectedCaseId,
    selectedEvidenceId,
    setSelectedEvidenceId,
    syncWithBackend,
    showToast,
    fetchCaseEvidence,
    verifyEvidence,
  } = useApp()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBatchUpload, setShowBatchUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [form, setForm] = useState({
    title: '',
    type: 'Document',
    description: '',
    date: todayISO(),
    source: '',
    relatedEntityId: '',
    status: 'Pending',
  })
  const selectedCase = useMemo(
    () => (selectedCaseId ? cases.find((c) => c.id === selectedCaseId) : null),
    [selectedCaseId, cases],
  )
  const caseEntities = useMemo(
    () => (selectedCaseId ? entities.filter((e) => e.caseId === selectedCaseId) : []),
    [entities, selectedCaseId],
  )
  const caseEvidence = useMemo(
    () => (selectedCaseId ? evidence.filter((e) => e.caseId === selectedCaseId) : []),
    [evidence, selectedCaseId],
  )
  const filtered = useMemo(() => {
    let list = [...caseEvidence]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          (e.id || '').toLowerCase().includes(q) ||
          (e.type || '').toLowerCase().includes(q) ||
          (e.source || '').toLowerCase().includes(q),
      )
    }
    if (categoryFilter !== 'All') list = list.filter((e) => e.type === categoryFilter)
    return list
  }, [caseEvidence, search, categoryFilter])
  const selected = useMemo(
    () => (selectedEvidenceId ? caseEvidence.find((e) => e.id === selectedEvidenceId) : null),
    [selectedEvidenceId, caseEvidence],
  )
  const getRelatedEntity = (entityId) => caseEntities.find((e) => e.id === entityId)
  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const handleVerifyEvidence = async (evidenceId) => {
    setVerifying(true)
    try {
      const res = await verifyEvidence(evidenceId)
      setVerificationResult(res)
      if (res?.valid) {
        showToast('Evidence integrity verified: SHA-256 matches ledger record.')
      } else {
        showToast('Warning: Evidence hash mismatch or unverified in ledger.', 'error')
      }
    } catch {
      showToast('Verification failed.', 'error')
    } finally {
      setVerifying(false)
    }
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile && !form.title.trim()) {
      showToast('Please select a file or enter a title', 'error')
      return
    }
    if (!selectedCaseId) {
      showToast('Please select a case first', 'error')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      if (selectedFile) {
        formData.append('file', selectedFile)
      }
      if (form.title) formData.append('title', form.title)
      if (form.type) formData.append('evidence_type', form.type)
      if (form.description) formData.append('description', form.description)
      if (form.date) formData.append('date', form.date)
      if (form.source) formData.append('source', form.source)
      if (form.status) formData.append('status', form.status)
      if (form.relatedEntityId) formData.append('related_entity_id', form.relatedEntityId)
      const response = await syncWithBackend(`/cases/${selectedCaseId}/evidence`, 'POST', formData, true)
      if (response?.data) {
        showToast('Evidence created and secured in ledger successfully')
        setForm({
          title: '',
          type: 'Document',
          description: '',
          date: todayISO(),
          source: '',
          relatedEntityId: '',
          status: 'Pending',
        })
        setSelectedFile(null)
        setShowAddForm(false)
        await fetchCaseEvidence(selectedCaseId)
      } else {
        showToast(response?.error || 'Failed to upload evidence', 'error')
      }
    } catch {
      showToast('Error uploading evidence', 'error')
    } finally {
      setUploading(false)
    }
  }
  if (!selectedCaseId) {
    return (
      <div className="page-content">
        <header className="page-header">
          <div>
            <h2 className="page-header__title">Evidence Vault</h2>
            <p className="page-header__desc">Secure evidence management with chain-of-custody tracking.</p>
          </div>
        </header>
        <div className="empty-state">
          <Icon name="shield" className="icon-lg" />
          <p>Select a case to view evidence.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Evidence Vault</h2>
          <p className="page-header__desc">
            Evidence for {selectedCase?.title || selectedCaseId} — {caseEvidence.length} items
          </p>
        </div>
        <div className="page-header__actions">
          <select
            className="toolbar__select"
            value={selectedCaseId || ''}
            onChange={(e) => setSelectedCaseId(e.target.value || null)}
          >
            <option value="">Select Case</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.title}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="category-tabs">
        {EVIDENCE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`category-tab ${categoryFilter === cat ? 'category-tab--active' : ''}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="toolbar__search">
          <Icon name="search" className="icon-sm" />
          <input
            type="text"
            placeholder="Search evidence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowBatchUpload(!showBatchUpload)}>
          <Icon name="upload" className="icon-xs" /> Batch Upload
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Icon name="plus" className="icon-xs" /> Add Evidence
        </button>
      </div>
      {showBatchUpload && (
        <section className="panel">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Batch Upload Evidence</h3>
              <p className="panel__subtitle">Upload multiple files at once with automatic duplicate detection</p>
            </div>
          </header>
          <div className="panel__body">
            <EvidenceUploader />
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setShowBatchUpload(false)}>
                Close
              </button>
            </div>
          </div>
        </section>
      )}
      {showAddForm && (
        <section className="panel">
          <header className="panel__header">
            <div>
              <h3 className="panel__title">Add Evidence</h3>
              <p className="panel__subtitle">Evidence will be assigned to case {selectedCaseId}</p>
            </div>
          </header>
          <div className="panel__body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormSection title="Evidence Information" subtitle="Basic metadata about the submitted evidence">
                <FormField label="Title">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="e.g. Financial Transaction Record"
                  />
                </FormField>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField label="Evidence Type">
                    <select value={form.type} onChange={(e) => updateField('type', e.target.value)}>
                      {EVIDENCE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Status">
                    <select value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                      {EVIDENCE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <FormField label="Description" full>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Describe the evidence item..."
                  />
                </FormField>
              </FormSection>
              <FormSection title="Source Information" subtitle="Where and when the evidence was collected">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField label="Collection Date">
                    <input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} />
                  </FormField>
                  <FormField label="Source">
                    <input
                      type="text"
                      value={form.source}
                      onChange={(e) => updateField('source', e.target.value)}
                      placeholder="e.g. Field Investigation"
                    />
                  </FormField>
                </div>
                <FormField label="Related Entity">
                  <select value={form.relatedEntityId} onChange={(e) => updateField('relatedEntityId', e.target.value)}>
                    <option value="">None</option>
                    {caseEntities.length === 0 ? (
                      <option disabled value="">
                        No related entities available for this case.
                      </option>
                    ) : (
                      caseEntities.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.name} ({ent.type || 'Entity'})
                        </option>
                      ))
                    )}
                  </select>
                </FormField>
              </FormSection>
              <FormSection title="Files" subtitle="Attach the source file for this evidence item">
                <div className="file-upload-wrapper">
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    accept="image/*,application/pdf,text/plain"
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
                <p className="m-0 text-[11px] text-[var(--text-muted)]">
                  Supported formats: JPG, PNG, PDF, TXT. Max 50MB.
                </p>
              </FormSection>
              <div className="flex items-center justify-end gap-3">
                <button type="button" className="btn btn--ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={uploading || (!selectedFile && !form.title.trim())}
                >
                  {uploading ? (
                    <Icon name="loader" className="icon-sm spin" />
                  ) : (
                    <Icon name="plus" className="icon-sm" />
                  )}
                  {uploading ? ' Uploading...' : ' Add Evidence'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Icon name="shield" className="icon-lg" />
          <p>No evidence has been added to this case yet.</p>
          <button type="button" className="btn btn--primary" onClick={() => setShowAddForm(true)}>
            <Icon name="plus" className="icon-xs" /> Add Evidence
          </button>
        </div>
      ) : (
        <div className="data-table-wrap panel">
          <table className="data-table data-table--clickable">
            <thead>
              <tr>
                <th>Evidence ID</th>
                <th>Title</th>
                <th>Type</th>
                <th>Related Entity</th>
                <th>Date</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const entity = getRelatedEntity(e.relatedEntityId)
                return (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedEvidenceId(e.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(ev) => ev.key === 'Enter' && setSelectedEvidenceId(e.id)}
                  >
                    <td>{e.id}</td>
                    <td className="data-table__desc">{e.title || e.description}</td>
                    <td>{e.type}</td>
                    <td>{entity ? entity.name : '—'}</td>
                    <td>{e.date}</td>
                    <td>{e.source}</td>
                    <td>
                      <span
                        className={`status-badge status-badge--${(e.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {e.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedEvidenceId(null)}
        title={selected ? selected.title || selected.id : 'Evidence Details'}
      >
        {selected && (
          <div className="evidence-detail">
            <div className="evidence-detail__type">{selected.type}</div>
            <h3 className="evidence-detail__desc">{selected.title || selected.description}</h3>
            {selected.description && selected.title && (
              <p className="evidence-detail__full-desc">{selected.description}</p>
            )}
            <dl className="detail-dl">
              <div>
                <dt>Evidence Type</dt>
                <dd>{selected.type}</dd>
              </div>
              <div>
                <dt>Related Case</dt>
                <dd>{selected.caseId}</dd>
              </div>
              <div>
                <dt>Related Entity</dt>
                <dd>{getRelatedEntity(selected.relatedEntityId)?.name || 'Unlinked'}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{selected.date}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{selected.source}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
              </div>
              {selected.sha256 && (
                <div>
                  <dt>SHA-256 Hash</dt>
                  <dd className="detail-dl__hash">{selected.sha256}</dd>
                </div>
              )}
            </dl>
            <div
              style={{
                marginTop: '1rem',
                marginBottom: '1rem',
                padding: '0.75rem',
                borderRadius: '6px',
                background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <strong style={{ fontSize: '0.85rem' }}>Cryptographic Integrity Verification</strong>
                <button
                  type="button"
                  className="btn btn--primary btn--xs"
                  onClick={() => handleVerifyEvidence(selected.id)}
                  disabled={verifying}
                >
                  <Icon name="shield" className="icon-xs" />
                  {verifying ? ' Verifying...' : ' Verify Evidence'}
                </button>
              </div>
              {verificationResult && verificationResult.evidence_id === selected.id && (
                <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span>Integrity Status:</span>
                    <span
                      className={`status-badge ${verificationResult.valid ? 'status-badge--verified' : 'status-badge--high'}`}
                    >
                      {verificationResult.valid ? 'VALID / INTACT' : verificationResult.status || 'UNVERIFIED'}
                    </span>
                    <span style={{ color: 'var(--text-muted, #888)' }}>
                      (Chain: {verificationResult.chain_valid ? 'Valid' : 'Broken'})
                    </span>
                  </div>
                  {verificationResult.calculated_hash && (
                    <div
                      style={{
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted, #aaa)',
                      }}
                    >
                      Recomputed: {verificationResult.calculated_hash}
                    </div>
                  )}
                </div>
              )}
            </div>
            <section className="case-detail__section">
              <CustodyTimeline evidenceId={selected.id} />
            </section>
            {selected.description && (
              <section className="case-detail__section">
                <h4>Description</h4>
                <p>{selected.description}</p>
              </section>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
