import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import MetricGrid from '../components/ui/MetricGrid'
import FormSection from '../components/forms/FormSection'
import FormField from '../components/forms/FormField'
import CheckboxGroup from '../components/forms/CheckboxGroup'
import EntityChipList from '../components/entities/EntityChipList'

const SOURCE_OPTIONS = ['Field Surveillance', 'Phone Intercept', 'Financial Records', 'Witness Statement', 'Digital Evidence', 'Human Intelligence', 'Other']

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function Intelligence() {
  const {
    cases, entities, relationships, intelligence,
    selectedCaseId, setSelectedCaseId, addIntelligence,
    aiSuggestions, runAIAnalysis, analyzing, analysisStep,
  } = useApp()

  const selectedCase = useMemo(() => selectedCaseId ? cases.find(c => c.id === selectedCaseId) : null, [selectedCaseId, cases])

  const caseEntities = useMemo(() => selectedCase ? entities.filter(e => e.caseId === selectedCase.id) : [], [entities, selectedCase])
  const caseRels = useMemo(() => selectedCase ? relationships.filter(r => r.caseId === selectedCase.id) : [], [relationships, selectedCase])
  const caseIntel = useMemo(() => {
    if (!selectedCase) return []
    return intelligence
      .filter(i => i.caseId === selectedCase.id)
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
  }, [intelligence, selectedCase])

  const pendingSuggestions = useMemo(() => {
    if (!selectedCase) return 0
    return aiSuggestions.filter(s => s.caseId === selectedCase.id && s.status === 'pending').length
  }, [aiSuggestions, selectedCase])

  const [form, setForm] = useState({ description: '', source: SOURCE_OPTIONS[0], date: todayISO(), entityIds: [] })

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const toggleEntity = (id) => {
    setForm(f => {
      const exists = f.entityIds.includes(id)
      return { ...f, entityIds: exists ? f.entityIds.filter(e => e !== id) : [...f.entityIds, id] }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.description.trim() || !selectedCase) return
    addIntelligence({
      caseId: selectedCase.id,
      description: form.description.trim(),
      source: form.source,
      date: form.date,
      entityIds: form.entityIds,
      createdAt: new Date().toISOString(),
    })
    setForm({ description: '', source: SOURCE_OPTIONS[0], date: todayISO(), entityIds: [] })
  }

  if (!selectedCase) {
    return (
      <div className="page-content">
        <header className="page-header">
          <div><h1>Intelligence Hub</h1></div>
          <div className="page-header__actions">
            <select className="toolbar__select" value={selectedCaseId || ''} onChange={e => setSelectedCaseId(e.target.value || null)}>
              <option value="">Select a case...</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </header>
        <div className="empty-state"><Icon name="shield" className="icon-lg" /><p>Select a case to view intelligence.</p></div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Intelligence Hub</h1>
          <p className="page-header__desc">Intelligence for {selectedCase.title}</p>
        </div>
        <div className="page-header__actions">
          <select className="toolbar__select" value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value || null)}>
            <option value="">Select a case...</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      </header>

      <MetricGrid
        ariaLabel="Intelligence metrics"
        items={[
          { id: 'intelligence-items', label: 'Total Intelligence Items', value: caseIntel.length, icon: 'shield', change: 'Reports collected' },
          { id: 'entities', label: 'Entities', value: caseEntities.length, icon: 'users', change: 'Persons of interest' },
          { id: 'suggestions', label: 'AI Suggestions', value: pendingSuggestions, icon: 'spark', change: 'Pending review' },
          { id: 'relationships', label: 'Relationships', value: caseRels.length, icon: 'network', change: 'Mapped connections' },
        ]}
      />

      {caseEntities.length > 0 ? (
        <section className="panel">
          <header className="panel__header">
            <div><h3 className="panel__title">Add Intelligence Report</h3><p className="panel__subtitle">Submit a new intelligence item for this case</p></div>
          </header>
          <div className="panel__body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormSection title="Report Information" subtitle="Describe the intelligence item being captured">
                <FormField label="Description" required>
                  <textarea rows={3} placeholder="Describe the intelligence item..." value={form.description} onChange={e => updateField('description', e.target.value)} required />
                </FormField>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField label="Source">
                    <select value={form.source} onChange={e => updateField('source', e.target.value)}>
                      {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Date">
                    <input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} />
                  </FormField>
                </div>
              </FormSection>

              <FormSection title="Entity Association" subtitle="Link the entities this report relates to">
                <CheckboxGroup items={caseEntities} selected={form.entityIds} onToggle={toggleEntity} title="Related Entities" />
              </FormSection>

              <div className="flex items-center justify-end gap-3">
                <button type="submit" className="btn btn--primary" disabled={!form.description.trim()}>
                  <Icon name="plus" className="icon-sm" /> Add Intelligence
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : (
        <div className="empty-state"><Icon name="users" className="icon-lg" /><p>Add entities first before adding intelligence.</p></div>
      )}

      <section className="panel">
        <header className="panel__header">
          <div><h3 className="panel__title">Intelligence Log</h3><p className="panel__subtitle">{caseIntel.length} item{caseIntel.length !== 1 ? 's' : ''}</p></div>
        </header>
        <div className="case-list">
          {caseIntel.length > 0 ? caseIntel.map(item => {
            const related = (item.relatedEntityIds || item.entityIds || [])
              .map(eid => caseEntities.find(e => e.id === eid))
              .filter(Boolean)
            return (
              <div key={item.id} className="case-list__item">
                <div className="case-list__main">
                  <span className="case-list__name">{item.text || item.description}</span>
                  <span className="case-list__status">
                    <span className="intel-source-badge">{item.source}</span>
                    <span className="intel-date">{item.date}</span>
                  </span>
                  {related.length > 0 && (
                    <div className="case-list__tags">
                      <EntityChipList entities={related} maxVisible={4} />
                    </div>
                  )}
                </div>
                <div className="case-list__meta">
                  <span className="case-list__meta">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </div>
            )
          }) : (
            <div className="empty-state"><p>No intelligence items yet. Add your first intelligence report.</p></div>
          )}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header">
          <div><h3 className="panel__title">AI Analysis</h3><p className="panel__subtitle">Leverage AI to uncover hidden patterns and connections</p></div>
        </header>
        <div className="panel__body">
          {analyzing ? (
            <div className="ai-progress">
              <Icon name="spark" className="icon-md spin" />
              <p>Running analysis — Step {analysisStep}...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="btn btn--primary" onClick={() => runAIAnalysis(selectedCase.id)} disabled={caseIntel.length === 0}>
                <Icon name="spark" className="icon-sm" /> Run AI Analysis
              </button>
              {pendingSuggestions > 0 && <span className="ai-badge">{pendingSuggestions} pending suggestion{pendingSuggestions !== 1 ? 's' : ''}</span>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
