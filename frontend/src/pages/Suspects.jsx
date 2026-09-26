import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import Drawer from '../components/Drawer'
import Modal from '../components/Modal'
import Icon from '../components/Icon'
import RiskBadge from '../components/RiskBadge'
import EntityChipList from '../components/entities/EntityChipList'
import FormSection from '../components/forms/FormSection'
import FormField from '../components/forms/FormField'

const RISK_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const STATUS_OPTIONS = ['ACTIVE', 'MONITORING', 'DETAINED', 'CLEARED']
const EMPTY_FORM = {
  name: '',
  aliases: '',
  age: '',
  gender: '',
  height: '',
  weight: '',
  occupation: '',
  nationality: '',
  address: '',
  phone: '',
  email: '',
  notes: '',
  risk: 'MEDIUM',
  status: 'ACTIVE',
}

function formFromEntity(entity) {
  if (!entity) return { ...EMPTY_FORM }
  return {
    name: entity.name || '',
    aliases: entity.aliases || '',
    age: entity.age ?? '',
    gender: entity.gender || '',
    height: entity.height ?? '',
    weight: entity.weight ?? '',
    occupation: entity.occupation || '',
    nationality: entity.nationality || '',
    address: entity.address || '',
    phone: entity.phone || '',
    email: entity.email || '',
    notes: entity.notes || entity.description || '',
    risk: String(entity.risk || 'MEDIUM').toUpperCase(),
    status: String(entity.status || 'ACTIVE').toUpperCase(),
  }
}

function displayValue(value) {
  return value || 'Not recorded'
}

function SuspectFormModal({ open, onClose, onSave, onPhoto, editing, canEdit, saving, uploadUrl }) {
  const [form, setForm] = useState(() => formFromEntity(editing))
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(() => {
    const existingPhoto = editing?.photo || editing?.photoPath
    return existingPhoto ? (existingPhoto.startsWith('blob:') ? existingPhoto : uploadUrl(existingPhoto)) : ''
  })
  const [errors, setErrors] = useState({})

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Full name is required'
    if (form.age !== '' && (Number(form.age) < 0 || Number(form.age) > 130)) nextErrors.age = 'Enter an age between 0 and 130'
    if (form.height !== '' && (Number(form.height) < 0 || Number(form.height) > 300)) nextErrors.height = 'Enter height between 0 and 300 cm'
    if (form.weight !== '' && (Number(form.weight) < 0 || Number(form.weight) > 500)) nextErrors.weight = 'Enter weight between 0 and 500 kg'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canEdit || !validate()) return
    const result = await onSave({ ...form, notes: form.notes.trim() })
    if (!result) return
    if (photoFile) await onPhoto(result.id, photoFile, result)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={editing ? 'Edit suspect profile' : 'Add suspect'}
      footer={(
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="suspect-profile-form" className="btn btn--primary" disabled={!canEdit || saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save suspect'}
          </button>
        </>
      )}
    >
      <form id="suspect-profile-form" className="suspect-form" onSubmit={handleSubmit}>
        <div className="suspect-form__intro">
          <div className="suspect-form__photo">
            {photoPreview ? (
              <img src={photoPreview} alt="Suspect preview" />
            ) : (
              <span><Icon name="user" className="icon-lg" /></span>
            )}
          </div>
          <div>
            <span className="suspect-form__eyebrow">PERSON OF INTEREST</span>
            <h3>{editing ? editing.name : 'Create a complete intelligence profile'}</h3>
            <p>Store verified identity details, risk assessment, and investigative context for this case.</p>
            {canEdit ? (
              <label className="btn btn--ghost btn--sm suspect-form__photo-button">
                <Icon name="plus" className="icon-xs" />
                {photoFile || editing?.photoPath ? 'Replace photo' : 'Add photo'}
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/bmp" onChange={handlePhotoChange} hidden />
              </label>
            ) : <span className="suspect-form__readonly">Read-only access</span>}
          </div>
        </div>

        <FormSection title="Identity" subtitle="Core identifiers used to distinguish this person in the intelligence graph">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Full name" required error={errors.name}>
              <input type="text" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="e.g. Vikram Patel" disabled={!canEdit} autoFocus />
            </FormField>
            <FormField label="Aliases" hint="Separate multiple aliases with commas">
              <input type="text" value={form.aliases} onChange={(event) => updateField('aliases', event.target.value)} placeholder="Known names or nicknames" disabled={!canEdit} />
            </FormField>
            <FormField label="Age" error={errors.age}>
              <input type="number" min="0" max="130" value={form.age} onChange={(event) => updateField('age', event.target.value)} placeholder="e.g. 38" disabled={!canEdit} />
            </FormField>
            <FormField label="Gender">
              <select value={form.gender} onChange={(event) => updateField('gender', event.target.value)} disabled={!canEdit}>
                <option value="">Not specified</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Other">Other</option>
              </select>
            </FormField>
            <FormField label="Height" hint="Centimetres" error={errors.height}>
              <input type="number" min="0" max="300" step="0.1" value={form.height} onChange={(event) => updateField('height', event.target.value)} placeholder="e.g. 178" disabled={!canEdit} />
            </FormField>
            <FormField label="Weight" hint="Kilograms" error={errors.weight}>
              <input type="number" min="0" max="500" step="0.1" value={form.weight} onChange={(event) => updateField('weight', event.target.value)} placeholder="e.g. 74" disabled={!canEdit} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Profile and risk" subtitle="Assessment context for investigators and network ranking">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Occupation">
              <input type="text" value={form.occupation} onChange={(event) => updateField('occupation', event.target.value)} placeholder="e.g. Logistics coordinator" disabled={!canEdit} />
            </FormField>
            <FormField label="Nationality">
              <input type="text" value={form.nationality} onChange={(event) => updateField('nationality', event.target.value)} placeholder="e.g. Indian" disabled={!canEdit} />
            </FormField>
            <FormField label="Risk level">
              <select value={form.risk} onChange={(event) => updateField('risk', event.target.value)} disabled={!canEdit}>
                {RISK_OPTIONS.map((option) => <option key={option} value={option}>{option.charAt(0) + option.slice(1).toLowerCase()}</option>)}
              </select>
            </FormField>
            <FormField label="Investigation status">
              <select value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled={!canEdit}>
                {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option.charAt(0) + option.slice(1).toLowerCase()}</option>)}
              </select>
            </FormField>
            <FormField label="Phone" full>
              <input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="+91 98XXX XXXXX" disabled={!canEdit} />
            </FormField>
            <FormField label="Email" full error={errors.email}>
              <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="name@example.com" disabled={!canEdit} />
            </FormField>
            <FormField label="Address" full>
              <input type="text" value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Last known or registered address" disabled={!canEdit} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Investigative notes" subtitle="Record context without losing the source or confidence">
          <FormField label="Notes" full>
            <textarea rows={5} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Known activity, indicators, assessments, and sources…" disabled={!canEdit} />
          </FormField>
        </FormSection>
      </form>
    </Modal>
  )
}

function SuspectAvatar({ entity, uploadUrl }) {
  const source = entity.photo || entity.photoPath
  const imageSource = source ? (source.startsWith('blob:') ? source : uploadUrl(source)) : null
  return (
    <div className="suspect-avatar" aria-hidden="true">
      {imageSource ? <img src={imageSource} alt="" /> : <span>{entity.name?.slice(0, 2).toUpperCase() || 'SI'}</span>}
    </div>
  )
}

export default function Suspects() {
  const {
    user, cases, entities, relationships, evidence, locations, timeline,
    selectedCaseId, selectedSuspectId, setSelectedSuspectId, suspectModalOpen,
    setSuspectModalOpen, createSuspect, updateSuspect, deleteSuspect,
    uploadSuspectPhoto, navigate, uploadUrl,
  } = useApp()
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const canEdit = user?.roleKey !== 'officer'
  const selectedCase = cases.find((item) => item.id === selectedCaseId)

  const caseEntities = useMemo(
    () => selectedCaseId ? entities.filter((entity) => entity.caseId === selectedCaseId) : [],
    [entities, selectedCaseId],
  )
  const suspects = useMemo(
    () => caseEntities.filter((entity) => entity.type === 'Person' && String(entity.role).toLowerCase() === 'suspect'),
    [caseEntities],
  )
  const caseRelationships = useMemo(
    () => selectedCaseId ? relationships.filter((relationship) => relationship.caseId === selectedCaseId) : [],
    [relationships, selectedCaseId],
  )
  const caseEvidence = useMemo(
    () => selectedCaseId ? evidence.filter((item) => item.caseId === selectedCaseId) : [],
    [evidence, selectedCaseId],
  )
  const caseLocations = useMemo(
    () => selectedCaseId ? locations.filter((item) => item.caseId === selectedCaseId) : [],
    [locations, selectedCaseId],
  )
  const caseTimeline = useMemo(
    () => selectedCaseId ? timeline.filter((item) => item.caseId === selectedCaseId) : [],
    [timeline, selectedCaseId],
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return suspects.filter((suspect) => {
      const matchesSearch = !query || [suspect.name, suspect.id, suspect.occupation, suspect.aliases, suspect.notes]
        .some((value) => String(value || '').toLowerCase().includes(query))
      const matchesRisk = riskFilter === 'all' || String(suspect.risk || '').toLowerCase() === riskFilter
      return matchesSearch && matchesRisk
    })
  }, [riskFilter, search, suspects])
  const selected = useMemo(
    () => suspects.find((suspect) => suspect.id === selectedSuspectId) || null,
    [selectedSuspectId, suspects],
  )
  const editing = useMemo(
    () => suspects.find((suspect) => suspect.id === editingId) || null,
    [editingId, suspects],
  )

  const getSuspectRelationships = (entityId) => caseRelationships.filter((relationship) => relationship.fromId === entityId || relationship.toId === entityId)
  const getRelatedEntities = (entityId) => getSuspectRelationships(entityId).map((relationship) => {
    const otherId = relationship.fromId === entityId ? relationship.toId : relationship.fromId
    const entity = caseEntities.find((item) => item.id === otherId)
    if (!entity) return null
    const relationshipLabel = relationship.label || relationship.type || 'Connected'
    return { ...entity, displayLabel: `${entity.name} · ${relationshipLabel.replace(/_/g, ' ')}` }
  }).filter(Boolean)
  const getSuspectEvidence = (entityId) => caseEvidence.filter((item) => item.relatedEntityId === entityId)
  const getSuspectLocations = (entityId) => caseLocations.filter((item) => item.entityId === entityId)
  const getSuspectTimeline = (entityId) => caseTimeline
    .filter((item) => item.entityId === entityId)
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  const openCreate = () => {
    setEditingId(null)
    setSuspectModalOpen(true)
  }

  const openEdit = (suspect) => {
    if (!canEdit) return
    setEditingId(suspect.id)
    setSuspectModalOpen(true)
  }

  const handleSave = async (formData) => {
    setSaving(true)
    const result = editingId
      ? await updateSuspect(editingId, formData)
      : await createSuspect({ ...formData, caseId: selectedCaseId })
    setSaving(false)
    return result
  }

  const handleDelete = async (suspect) => {
    if (!canEdit || !window.confirm(`Delete ${suspect.name} from this case?`)) return
    await deleteSuspect(suspect.id)
  }

  if (!selectedCaseId) {
    return (
      <div className="page-content">
        <header className="page-header">
          <div>
            <h2 className="page-header__title">Suspects</h2>
            <p className="page-header__desc">Person-of-interest registry with connection intelligence.</p>
          </div>
        </header>
        <div className="empty-state">
          <Icon name="users" className="icon-lg" />
          <p>Select a case before managing suspects.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('cases')}>Open cases</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content suspects-page">
      <header className="page-header suspects-page__header">
        <div>
          <span className="page-header__eyebrow">CASE INTELLIGENCE / {selectedCase?.id || selectedCaseId}</span>
          <h2 className="page-header__title">Suspects</h2>
          <p className="page-header__desc">{selectedCase?.title || 'Active investigation'} · {suspects.length} person{suspects.length === 1 ? '' : 's'} of interest</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Icon name="plus" className="icon-xs" /> Add suspect
          </button>
        ) : <span className="access-note"><Icon name="lock" className="icon-xs" /> Read-only access</span>}
      </header>

      <div className="suspect-summary-strip">
        <div><span>Identified</span><strong>{suspects.length}</strong></div>
        <div><span>High / critical risk</span><strong>{suspects.filter((item) => ['HIGH', 'CRITICAL'].includes(String(item.risk).toUpperCase())).length}</strong></div>
        <div><span>With connections</span><strong>{suspects.filter((item) => getSuspectRelationships(item.id).length > 0).length}</strong></div>
        <div><span>Last updated</span><strong>{suspects[0]?.createdAt?.slice(0, 10) || '—'}</strong></div>
      </div>

      <div className="toolbar suspects-toolbar">
        <div className="toolbar__search">
          <Icon name="search" className="icon-sm" />
          <input type="text" placeholder="Search name, alias, occupation…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="toolbar__select" aria-label="Filter suspects by risk">
          <option value="all">All risk levels</option>
          {RISK_OPTIONS.map((option) => <option key={option} value={option.toLowerCase()}>{option.charAt(0) + option.slice(1).toLowerCase()}</option>)}
        </select>
        <span className="toolbar__result-count">{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state suspects-empty-state">
          <div className="empty-state__icon"><Icon name="users" className="icon-lg" /></div>
          <h3>{suspects.length === 0 ? 'No suspects identified yet' : 'No suspects match your filters'}</h3>
          <p>{suspects.length === 0 ? 'Create a structured person-of-interest profile to begin the investigation.' : 'Try a different search term or risk level.'}</p>
          {suspects.length === 0 && canEdit && <button type="button" className="btn btn--primary" onClick={openCreate}><Icon name="plus" className="icon-xs" /> Add first suspect</button>}
        </div>
      ) : (
        <div className="suspect-cards">
          {filtered.map((suspect) => {
            const relationshipCount = getSuspectRelationships(suspect.id).length
            const evidenceCount = getSuspectEvidence(suspect.id).length
            return (
              <button key={`${suspect.caseId}-${suspect.id}`} type="button" className="suspect-card" onClick={() => setSelectedSuspectId(suspect.id)}>
                <div className="suspect-card__identity">
                  <SuspectAvatar entity={suspect} uploadUrl={uploadUrl} />
                  <div className="suspect-card__identity-copy">
                    <div className="suspect-card__header">
                      <h3 className="suspect-card__name">{suspect.name}</h3>
                      <RiskBadge level={suspect.risk} />
                    </div>
                    <span className="suspect-card__type">Person · Suspect · {suspect.status || 'Active'}</span>
                  </div>
                </div>
                {(suspect.occupation || suspect.notes) && <p className="suspect-card__desc">{suspect.occupation || suspect.notes}</p>}
                <div className="suspect-card__meta">
                  <span><Icon name="link" className="icon-xs" /> {relationshipCount} connection{relationshipCount === 1 ? '' : 's'}</span>
                  <span><Icon name="shield" className="icon-xs" /> {evidenceCount} evidence</span>
                  {suspect.address && <span><Icon name="location" className="icon-xs" /> {suspect.address}</span>}
                </div>
                <div className="suspect-card__footer">
                  <span className="suspect-card__activity">Updated {suspect.createdAt?.slice(0, 10) || 'today'}</span>
                  <Icon name="chevron" className="icon-xs" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelectedSuspectId(null)} title={selected ? selected.name : 'Suspect details'} width="560px">
        {selected && (
          <div className="suspect-detail">
            <div className="suspect-detail__hero">
              <SuspectAvatar entity={selected} uploadUrl={uploadUrl} />
              <div>
                <div className="suspect-detail__badges"><RiskBadge level={selected.risk} /><span className="status-badge status-badge--pending">{selected.status || 'ACTIVE'}</span></div>
                <h3>{selected.name}</h3>
                <span className="suspect-detail__id">{selected.id} · {selected.caseId}</span>
              </div>
            </div>
            <div className="suspect-detail__actions">
              {canEdit && <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(selected)}><Icon name="edit" className="icon-xs" /> Edit</button>}
              <button type="button" className="btn btn--primary btn--sm" onClick={() => { setSelectedSuspectId(null); navigate('network', { suspectId: selected.id }) }}><Icon name="network" className="icon-xs" /> View network</button>
              {canEdit && <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(selected)}><Icon name="trash" className="icon-xs" /> Delete</button>}
            </div>

            {selected.notes && <p className="suspect-detail__summary">{selected.notes}</p>}

            <section className="case-detail__section">
              <h4>Profile</h4>
              <dl className="detail-dl">
                <div><dt>Age</dt><dd>{displayValue(selected.age)}</dd></div>
                <div><dt>Gender</dt><dd>{displayValue(selected.gender)}</dd></div>
                <div><dt>Height</dt><dd>{selected.height ? `${selected.height} cm` : 'Not recorded'}</dd></div>
                <div><dt>Weight</dt><dd>{selected.weight ? `${selected.weight} kg` : 'Not recorded'}</dd></div>
                <div><dt>Occupation</dt><dd>{displayValue(selected.occupation)}</dd></div>
                <div><dt>Nationality</dt><dd>{displayValue(selected.nationality)}</dd></div>
                <div><dt>Phone</dt><dd>{displayValue(selected.phone)}</dd></div>
                <div><dt>Email</dt><dd>{displayValue(selected.email)}</dd></div>
                <div><dt>Address</dt><dd>{displayValue(selected.address)}</dd></div>
                <div><dt>Aliases</dt><dd>{displayValue(selected.aliases)}</dd></div>
              </dl>
            </section>

            <section className="case-detail__section">
              <h4>Relationships</h4>
              <EntityChipList entities={getRelatedEntities(selected.id)} maxVisible={6} title="Connected entities" onSelect={(entity) => { setSelectedSuspectId(null); navigate('network', { suspectId: entity.id }) }} emptyText="No relationships mapped yet." />
            </section>

            <section className="case-detail__section">
              <h4>Evidence / intelligence</h4>
              {getSuspectEvidence(selected.id).length === 0 ? <p className="empty-text">No evidence linked yet.</p> : <ul className="detail-list">{getSuspectEvidence(selected.id).map((item) => <li key={item.id}>{item.title || item.description}</li>)}</ul>}
            </section>

             <section className="case-detail__section">
               <h4>Known locations</h4>
               {getSuspectLocations(selected.id).length === 0 ? <p className="empty-text">No locations mapped yet.</p> : <ul className="detail-list">{getSuspectLocations(selected.id).map((item) => <li key={item.id}>{item.name || item.address || item.location}</li>)}</ul>}
             </section>

             <section className="case-detail__section">
               <h4>Timeline activity</h4>

              {getSuspectTimeline(selected.id).length === 0 ? <p className="empty-text">No timeline events.</p> : <ul className="timeline">{getSuspectTimeline(selected.id).slice(0, 6).map((item) => <li key={item.id} className="timeline__item"><span className="timeline__date">{item.date}</span><span className="timeline__event">{item.event}</span></li>)}</ul>}
            </section>
          </div>
        )}
      </Drawer>

      <SuspectFormModal
        key={`${editing?.id || 'new'}-${suspectModalOpen ? 'open' : 'closed'}`}
        open={suspectModalOpen}
        onClose={() => { setSuspectModalOpen(false); setEditingId(null) }}
        onSave={handleSave}
        onPhoto={uploadSuspectPhoto}
        uploadUrl={uploadUrl}
        editing={editing}
        canEdit={canEdit}
        saving={saving}
      />
    </div>
  )
}
