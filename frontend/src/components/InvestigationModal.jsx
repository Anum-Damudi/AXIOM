import { useState } from 'react'
import Modal from './Modal'
import FormSection from './forms/FormSection'
import FormField from './forms/FormField'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const TYPES = ['Financial Fraud', 'Cybercrime', 'Organized Crime', 'Trafficking', 'Extortion', 'Theft', 'Other']

export default function InvestigationModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '', primarySubject: '', caseId: '', priority: 'HIGH', type: 'Financial Fraud',
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
      <form id="investigation-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormSection title="Operational Details" subtitle="Core identifiers for the new investigation">
          <FormField label="Investigation Name" required>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Operation Shadow Ledger Phase II" required />
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Primary Subject">
              <input type="text" value={form.primarySubject} onChange={e => setForm({...form, primarySubject: e.target.value})} placeholder="e.g. Rajesh K." />
            </FormField>
            <FormField label="Case ID">
              <input type="text" value={form.caseId} onChange={e => setForm({...form, caseId: e.target.value})} placeholder="e.g. NX-2026-041" />
            </FormField>
          </div>
        </FormSection>
        <FormSection title="Classification" subtitle="Prioritise the investigation and select its category">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Priority">
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Investigation Type">
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
        </FormSection>
      </form>
    </Modal>
  )
}

export function NewCaseModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', priority: 'MEDIUM', type: 'Other', location: '', date: '', description: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onCreate({
      ...form,
      date: form.date || new Date().toISOString().slice(0, 10),
    })
    setForm({ title: '', priority: 'MEDIUM', type: 'Other', location: '', date: '', description: '' })
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Case"
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="new-case-form" className="btn btn--primary">Create Case</button>
      </>}>
      <form id="new-case-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormSection title="Case Information" subtitle="Name the case and set its primary attributes">
          <FormField label="Case Title" required>
            <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Warehouse Theft" required />
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Case Type">
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Priority">
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Date">
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            </FormField>
            <FormField label="Location">
              <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Mumbai" />
            </FormField>
          </div>
        </FormSection>
        <FormSection title="Summary" subtitle="Brief context for the case file">
          <FormField label="Description" full>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="Brief case description" />
          </FormField>
        </FormSection>
      </form>
    </Modal>
  )
}

export function LinkEvidenceModal({ open, onClose, onLink, cases, entities, evidenceId }) {
  const [caseId, setCaseId] = useState('')
  const [personId, setPersonId] = useState('')

  const caseEntities = caseId ? entities.filter(e => e.caseId === caseId && e.type === 'Person') : []

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!caseId) return
    onLink(evidenceId, caseId, personId || null)
    setCaseId(''); setPersonId('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Link Evidence"
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="link-evidence-form" className="btn btn--primary">Link Evidence</button>
      </>}>
      <form id="link-evidence-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormSection title="Link Target">
          <p className="m-0 text-[12px] text-[var(--text-muted)]">Linking evidence: <strong className="text-[var(--text-secondary)]">{evidenceId}</strong></p>
          <FormField label="Related Case" required>
            <select value={caseId} onChange={e => setCaseId(e.target.value)} required>
              <option value="">Select case</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
            </select>
          </FormField>
          <FormField label="Related Entity (optional)" hint={caseEntities.length === 0 && caseId ? 'No persons in this case.' : undefined}>
            <select value={personId} onChange={e => setPersonId(e.target.value)} disabled={!caseId}>
              <option value="">None</option>
              {caseEntities.map(en => <option key={en.id} value={en.id}>{en.name} ({en.role || en.type})</option>)}
            </select>
          </FormField>
        </FormSection>
      </form>
    </Modal>
  )
}
