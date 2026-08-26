import { useState } from 'react'
import Modal from './Modal'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const TYPES = ['Financial Fraud', 'Cybercrime', 'Organized Crime', 'Trafficking', 'Extortion', 'Other']

export default function InvestigationModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '',
    primarySubject: '',
    caseId: '',
    priority: 'HIGH',
    type: 'Financial Fraud',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onCreate(form)
    setForm({ name: '', primarySubject: '', caseId: '', priority: 'HIGH', type: 'Financial Fraud' })
  }

  const footer = (
    <>
      <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
      <button type="submit" form="investigation-form" className="btn btn--primary">Create Investigation</button>
    </>
  )

  return (
    <Modal open={open} onClose={onClose} title="Start New Investigation" footer={footer}>
      <form id="investigation-form" className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Investigation Name</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Operation Shadow Ledger Phase II"
            required
          />
        </label>
        <label className="form-field">
          <span>Primary Subject</span>
          <input
            type="text"
            value={form.primarySubject}
            onChange={(e) => setForm({ ...form, primarySubject: e.target.value })}
            placeholder="e.g. Rajesh K."
          />
        </label>
        <label className="form-field">
          <span>Case ID</span>
          <input
            type="text"
            value={form.caseId}
            onChange={(e) => setForm({ ...form, caseId: e.target.value })}
            placeholder="e.g. NX-2026-041"
          />
        </label>
        <div className="form-row">
          <label className="form-field">
            <span>Priority</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Investigation Type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
      </form>
    </Modal>
  )
}

export function NewCaseModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', priority: 'MEDIUM', description: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onCreate(form)
    setForm({ title: '', priority: 'MEDIUM', description: '' })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Case"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="new-case-form" className="btn btn--primary">Create Case</button>
        </>
      }
    >
      <form id="new-case-form" className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Case Name</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Operation name"
            required
          />
        </label>
        <label className="form-field">
          <span>Priority</span>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Brief case description"
          />
        </label>
      </form>
    </Modal>
  )
}

export function LinkEvidenceModal({ open, onClose, onLink, cases, suspects, evidenceId }) {
  const [caseId, setCaseId] = useState('')
  const [personId, setPersonId] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!caseId) return
    onLink(evidenceId, caseId, personId || null)
    setCaseId('')
    setPersonId('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link Evidence"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="link-evidence-form" className="btn btn--primary">Link Evidence</button>
        </>
      }
    >
      <form id="link-evidence-form" className="form" onSubmit={handleSubmit}>
        <p className="form-hint">Linking evidence: <strong>{evidenceId}</strong></p>
        <label className="form-field">
          <span>Related Case</span>
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)} required>
            <option value="">Select case</option>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Related Person (optional)</span>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">None</option>
            {suspects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </form>
    </Modal>
  )
}
