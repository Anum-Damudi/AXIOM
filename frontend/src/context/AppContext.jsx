import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  INITIAL_NOTIFICATIONS,
  INVESTIGATIONS as INITIAL_INVESTIGATIONS,
} from '../data/mockData'
import { buildDemoData } from '../data/demoCase'
import { getNavByRole } from '../data/users'
import {
  loadInvestigations, loadSettings, saveInvestigations, saveSettings,
  loadSession, saveSession,
  loadCases, saveCases, loadEntities, saveEntities,
  loadRelationships, saveRelationships,
  loadIntelligence, saveIntelligence,
  loadAISuggestions, saveAISuggestions,
  loadTimeline, saveTimeline,
  loadLocations, saveLocations,
  loadEvidence, saveEvidence,
} from '../utils/storage'
import { analyzeCase, simulateAnalysisProgress } from '../services/aiAnalysisService'

const AppContext = createContext(null)

function buildInitialData() {
  const demo = buildDemoData()
  const savedCases = loadCases()
  if (savedCases.length > 0) {
    return {
      cases: savedCases,
      entities: loadEntities(),
      relationships: loadRelationships(),
      intelligence: loadIntelligence(),
      evidence: loadEvidence(),
      aiSuggestions: loadAISuggestions(),
      timeline: loadTimeline(),
      locations: loadLocations(),
    }
  }
  return {
    cases: demo.cases,
    entities: demo.entities,
    relationships: demo.relationships,
    intelligence: demo.intelligence,
    evidence: demo.evidence,
    aiSuggestions: demo.aiSuggestions,
    timeline: demo.timeline,
    locations: demo.locations,
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => { const s = loadSession(); return s?.user || null })
  const [page, setPage] = useState('landing')
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [investigationModalOpen, setInvestigationModalOpen] = useState(false)
  const [startInvestigationOnNetwork, setStartInvestigationOnNetwork] = useState(false)

  const initialData = useMemo(() => buildInitialData(), [])
  const [cases, setCases] = useState(initialData.cases)
  const [entities, setEntities] = useState(initialData.entities)
  const [relationships, setRelationships] = useState(initialData.relationships)
  const [intelligence, setIntelligence] = useState(initialData.intelligence)
  const [aiSuggestions, setAISuggestions] = useState(initialData.aiSuggestions)
  const [timeline, setTimeline] = useState(initialData.timeline)
  const [locations, setLocations] = useState(initialData.locations)
  const [evidence, setEvidence] = useState(initialData.evidence)

  const [investigations, setInvestigations] = useState(() => {
    const loaded = loadInvestigations()
    return loaded.length > 0 ? loaded : INITIAL_INVESTIGATIONS
  })
  const [activeInvestigation, setActiveInvestigation] = useState(null)
  const [activeCaseId, setActiveCaseId] = useState(null)
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const [toasts, setToasts] = useState([])
  const [settings, setSettings] = useState(loadSettings)

  const [caseFilter, setCaseFilter] = useState('')
  const [caseHighRiskOnly, setCaseHighRiskOnly] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState(null)
  const [selectedSuspectId, setSelectedSuspectId] = useState(null)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(null)
  const [networkFocusEntity, setNetworkFocusEntity] = useState(null)
  const [selectedNetworkNode, setSelectedNetworkNode] = useState(null)

  const [newCaseModalOpen, setNewCaseModalOpen] = useState(false)
  const [linkEvidenceModalOpen, setLinkEvidenceModalOpen] = useState(false)
  const [linkEvidenceId, setLinkEvidenceId] = useState(null)
  const [addEntityModalOpen, setAddEntityModalOpen] = useState(false)
  const [addRelationshipModalOpen, setAddRelationshipModalOpen] = useState(false)

  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState('')

  const navItems = useMemo(() => getNavByRole(), [])

  useEffect(() => { saveCases(cases) }, [cases])
  useEffect(() => { saveEntities(entities) }, [entities])
  useEffect(() => { saveRelationships(relationships) }, [relationships])
  useEffect(() => { saveIntelligence(intelligence) }, [intelligence])
  useEffect(() => { saveAISuggestions(aiSuggestions) }, [aiSuggestions])
  useEffect(() => { saveTimeline(timeline) }, [timeline])
  useEffect(() => { saveLocations(locations) }, [locations])
  useEffect(() => { saveEvidence(evidence) }, [evidence])

  const login = useCallback(async (name, email) => {
    const enrichedUser = { name: name || email.split('@')[0], email, role: 'investigator', roleKey: 'investigator', roleLabel: 'Investigator' }
    setUser(enrichedUser)
    saveSession({ user: enrichedUser, token: 'demo-token' })
    setPage('dashboard')
    if (cases.length > 0 && !selectedCaseId) {
      setSelectedCaseId(cases[0].id)
      setActiveCaseId(cases[0].id)
    }
    return { user: enrichedUser }
  }, [cases, selectedCaseId])

  const logout = useCallback(() => {
    setUser(null); saveSession(null); setPage('landing'); setActiveView('dashboard')
    setProfileOpen(false); setSelectedCaseId(null); setSelectedSuspectId(null)
    setSelectedEvidenceId(null); setSelectedNetworkNode(null)
    setActiveInvestigation(null); setActiveCaseId(null)
    setNotificationsOpen(false); setSearchOpen(false)
  }, [])

  const navigateTo = useCallback((targetPage) => { setPage(targetPage) }, [])

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  const showToast = useCallback((message, type = 'success') => {
    const id = `toast-${Date.now()}`
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)) }, 3500)
  }, [])

  const navigate = useCallback((view, options = {}) => {
    setActiveView(view); setSidebarOpen(false); setSearchOpen(false); setProfileOpen(false)
    if (options.filter === 'highRisk') { setCaseHighRiskOnly(true); setCaseFilter('') }
    else if (view !== 'cases') { setCaseHighRiskOnly(false) }
    if (options.caseId) { setSelectedCaseId(options.caseId); setActiveCaseId(options.caseId) }
    if (options.suspectId) { setSelectedSuspectId(options.suspectId); if (view === 'network') setNetworkFocusEntity(options.suspectId) }
    if (options.evidenceId) { setSelectedEvidenceId(options.evidenceId) }
    if (options.openInvestigation) { setStartInvestigationOnNetwork(true) }
    if (options.networkNode) { setSelectedNetworkNode(options.networkNode) }
  }, [])

  const openStartInvestigation = useCallback(() => { setInvestigationModalOpen(true) }, [])

  const createInvestigation = useCallback((data) => {
    const inv = { id: `INV-${Date.now()}`, ...data, createdAt: new Date().toISOString() }
    const updated = [inv, ...investigations]
    setInvestigations(updated); saveInvestigations(updated)
    setActiveInvestigation(inv); setInvestigationModalOpen(false)
    setStartInvestigationOnNetwork(true); navigate('network')
    showToast(`Investigation "${data.name}" created successfully`)
  }, [investigations, navigate, showToast])

  const addCase = useCallback((data) => {
    const id = data.id || `NX-2026-${String(Math.floor(Math.random() * 900) + 100)}`
    const newCase = {
      id, title: data.title, type: data.type || 'Other', priority: data.priority || 'MEDIUM',
      status: 'Active', leadInvestigator: user?.name || 'Unassigned', entities: 0,
      lastUpdated: new Date().toISOString().slice(0, 10),
      risk: data.priority === 'CRITICAL' || data.priority === 'HIGH' ? 'HIGH' : (data.priority || 'MEDIUM'),
      description: data.description || '', location: data.location || '',
      date: data.date || new Date().toISOString().slice(0, 10),
      persons: [], evidence: [],
      timeline: [{ date: new Date().toISOString().slice(0, 10), event: 'Case opened', type: 'CASE_EVENT' }],
    }
    setCases(prev => [newCase, ...prev])
    setNewCaseModalOpen(false)
    showToast(`Case "${newCase.title}" created`)
    setSelectedCaseId(newCase.id); setActiveCaseId(newCase.id)
    setActiveInvestigation({ id: `INV-${Date.now()}`, name: newCase.title, caseId: newCase.id, priority: newCase.priority, type: newCase.type, status: 'Active', createdAt: new Date().toISOString() })
    const tlEntry = {
      id: `tl-${Date.now()}`, caseId: newCase.id, date: new Date().toISOString().slice(0, 10),
      event: 'Case opened', type: 'CASE_EVENT', createdAt: new Date().toISOString(),
    }
    setTimeline(prev => [tlEntry, ...prev])
    return newCase
  }, [showToast, user])

  const updateCaseStatus = useCallback((caseId, status) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, status, lastUpdated: new Date().toISOString().slice(0, 10) } : c))
    showToast(`Case status updated to ${status}`)
  }, [showToast])

  const addEntity = useCallback((data) => {
    const entity = {
      id: data.id || `ENT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      caseId: data.caseId, type: data.type, name: data.name, risk: data.risk || 'LOW',
      role: data.role || '', description: data.description || '', data: data.data || {},
      createdAt: new Date().toISOString(),
    }
    setEntities(prev => [...prev, entity])
    const tlEntry = {
      id: `tl-${Date.now()}`, caseId: data.caseId, date: new Date().toISOString().slice(0, 10),
      event: `Entity added: ${entity.name} (${entity.type})`, type: 'ENTITY_ADDED',
      entityId: entity.id, createdAt: new Date().toISOString(),
    }
    setTimeline(prev => [tlEntry, ...prev])
    showToast(`Entity "${entity.name}" added`)
    return entity
  }, [showToast])

  const addRelationship = useCallback((data) => {
    if (data.fromId === data.toId) { showToast('Cannot create self-relationship', 'error'); return null }
    const fromEntity = entities.find(e => e.id === data.fromId)
    const toEntity = entities.find(e => e.id === data.toId)
    const rel = {
      id: data.id || `REL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      caseId: data.caseId, fromId: data.fromId, toId: data.toId,
      type: data.type || 'CONNECTED_TO', label: data.label || '',
      status: 'MANUAL', createdAt: new Date().toISOString(),
    }
    setRelationships(prev => [...prev, rel])
    const tlEntry = {
      id: `tl-${Date.now()}`, caseId: data.caseId, date: new Date().toISOString().slice(0, 10),
      event: `Relationship added: ${fromEntity?.name || data.fromId} → ${toEntity?.name || data.toId}`,
      type: 'RELATIONSHIP_CONFIRMED', createdAt: new Date().toISOString(),
    }
    setTimeline(prev => [tlEntry, ...prev])
    showToast('Relationship added')
    return rel
  }, [entities, showToast])

  const addIntelligence = useCallback((data) => {
    const item = {
      id: `INT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      caseId: data.caseId, text: data.text || data.description || '',
      source: data.source || 'Field Report',
      date: data.date || new Date().toISOString().slice(0, 10),
      relatedEntityIds: data.relatedEntityIds || data.entityIds || [],
      createdAt: new Date().toISOString(),
    }
    setIntelligence(prev => [item, ...prev])
    const tlEntry = {
      id: `tl-${Date.now()}`, caseId: data.caseId, date: item.date,
      event: `Intelligence added: ${(item.text || '').slice(0, 60)}...`, type: 'INTELLIGENCE_ADDED',
      createdAt: new Date().toISOString(),
    }
    setTimeline(prev => [tlEntry, ...prev])
    showToast('Intelligence added')
    return item
  }, [showToast])

  const addLocation = useCallback((data) => {
    const loc = {
      id: data.id || `LOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      caseId: data.caseId,
      name: data.name,
      type: data.type || data.locationType || 'Other',
      description: data.description || '',
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address || '',
      caseName: data.caseName || '',
      relatedEntityIds: data.relatedEntityIds || (data.entityId ? [data.entityId] : []),
      relatedEvidenceIds: data.relatedEvidenceIds || [],
      createdAt: new Date().toISOString(),
    }
    setLocations(prev => [...prev, loc])
    const tlEntry = {
      id: `tl-${Date.now()}`, caseId: data.caseId, date: new Date().toISOString().slice(0, 10),
      event: `Location recorded: ${loc.name}`,
      type: 'LOCATION_RECORDED', locationId: loc.id,
      createdAt: new Date().toISOString(),
    }
    setTimeline(prev => [tlEntry, ...prev])
    showToast(`Location "${loc.name}" recorded`)
    return loc
  }, [showToast])

  const updateLocation = useCallback((locationId, updates) => {
    setLocations(prev => prev.map(loc =>
      loc.id === locationId ? { ...loc, ...updates } : loc
    ))
    showToast('Location updated')
  }, [showToast])

  const deleteLocation = useCallback((locationId) => {
    const loc = locations.find(l => l.id === locationId)
    setLocations(prev => prev.filter(loc => loc.id !== locationId))
    showToast(loc ? `Location "${loc.name}" deleted` : 'Location deleted')
  }, [locations, showToast])

  const addEvidence = useCallback((data) => {
    const item = {
      id: data.id || `EVD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      caseId: data.caseId,
      title: data.title || '',
      type: data.type || 'Other',
      description: data.description || '',
      date: data.date || new Date().toISOString().slice(0, 10),
      source: data.source || 'Field Report',
      relatedEntityId: data.relatedEntityId || null,
      status: data.status || 'Pending',
      createdAt: new Date().toISOString(),
    }
    setEvidence(prev => [item, ...prev])
    const entity = item.relatedEntityId ? entities.find(e => e.id === item.relatedEntityId) : null
    const tlEntry = {
      id: `tl-${Date.now()}`, caseId: data.caseId, date: item.date,
      event: `Evidence added: ${item.title}${entity ? ` (Related: ${entity.name})` : ''}`,
      type: 'EVIDENCE_ADDED', createdAt: new Date().toISOString(),
    }
    setTimeline(prev => [tlEntry, ...prev])
    showToast(`Evidence "${item.title}" added`)
    return item
  }, [entities, showToast])

  const runAIAnalysis = useCallback(async (caseId) => {
    const caseEntities = entities.filter(e => e.caseId === caseId)
    const caseIntel = intelligence.filter(i => i.caseId === caseId)
    const caseLocations = locations.filter(l => l.caseId === caseId)
    if (caseEntities.length < 2) {
      showToast('Need at least 2 entities to run analysis', 'error')
      return []
    }
    setAnalyzing(true)
    await simulateAnalysisProgress((msg) => setAnalysisStep(msg))
    const suggestions = analyzeCase(caseEntities, caseIntel, caseLocations)
    const suggestionsWithCase = suggestions.map(s => ({ ...s, caseId }))
    setAISuggestions(prev => {
      const filtered = prev.filter(s => s.caseId !== caseId || s.status !== 'PENDING')
      return [...filtered, ...suggestionsWithCase]
    })
    const tlEntry = {
      id: `tl-${Date.now()}`, caseId, date: new Date().toISOString().slice(0, 10),
      event: `AI analysis completed — ${suggestionsWithCase.length} potential relationships identified`,
      type: 'AI_ANALYSIS', createdAt: new Date().toISOString(),
    }
    setTimeline(prev => [tlEntry, ...prev])
    setAnalyzing(false); setAnalysisStep('')
    showToast(`AI analysis complete — ${suggestionsWithCase.length} suggestions found`)
    return suggestionsWithCase
  }, [entities, intelligence, locations, showToast])

  const acceptSuggestion = useCallback((suggestionId) => {
    setAISuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, status: 'ACCEPTED' } : s))
    const suggestion = aiSuggestions.find(s => s.id === suggestionId)
    if (suggestion) {
      const rel = {
        id: `REL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        caseId: suggestion.caseId, fromId: suggestion.fromId, toId: suggestion.toId,
        type: suggestion.type, label: suggestion.reason?.slice(0, 80) || '',
        status: 'AI_CONFIRMED', confidence: suggestion.confidence,
        createdAt: new Date().toISOString(),
      }
      setRelationships(prev => [...prev, rel])
      const tlEntry = {
        id: `tl-${Date.now()}`, caseId: suggestion.caseId, date: new Date().toISOString().slice(0, 10),
        event: `Relationship confirmed: ${suggestion.fromName} → ${suggestion.toName} (${suggestion.confidence}% confidence)`,
        type: 'RELATIONSHIP_CONFIRMED', createdAt: new Date().toISOString(),
      }
      setTimeline(prev => [tlEntry, ...prev])
      showToast(`Relationship accepted: ${suggestion.fromName} → ${suggestion.toName}`)
    }
  }, [aiSuggestions, showToast])

  const rejectSuggestion = useCallback((suggestionId) => {
    setAISuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, status: 'REJECTED' } : s))
    showToast('Suggestion rejected', 'info')
  }, [showToast])

  const linkEvidence = useCallback(() => {
    setLinkEvidenceModalOpen(false); setLinkEvidenceId(null)
    showToast('Evidence linked successfully')
  }, [showToast])

  const dismissNotification = useCallback((id) => { setNotifications(prev => prev.filter(n => n.id !== id)) }, [])
  const markNotificationsRead = useCallback(() => { setNotifications(prev => prev.map(n => ({ ...n, read: true }))) }, [])

  const updateSettings = useCallback((patch) => {
    setSettings(prev => { const next = { ...prev, ...patch }; saveSettings(next); return next })
    showToast('Settings saved')
  }, [showToast])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false); setNotificationsOpen(false); setProfileOpen(false)
        setInvestigationModalOpen(false); setNewCaseModalOpen(false); setLinkEvidenceModalOpen(false)
        setAddEntityModalOpen(false); setAddRelationshipModalOpen(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo(() => ({
    user, isAuthenticated: !!user, page, navigateTo, login, logout,
    activeView, sidebarOpen, sidebarCollapsed, searchOpen, notificationsOpen, profileOpen,
    investigationModalOpen, startInvestigationOnNetwork,
    cases, entities, relationships, intelligence, evidence, aiSuggestions, timeline, locations, investigations,
    activeInvestigation, activeCaseId, notifications, toasts, settings,
    caseFilter, caseHighRiskOnly, selectedCaseId, selectedSuspectId, selectedEvidenceId,
    networkFocusEntity, selectedNetworkNode,
    newCaseModalOpen, linkEvidenceModalOpen, linkEvidenceId,
    addEntityModalOpen, addRelationshipModalOpen,
    analyzing, analysisStep,
    unreadCount, navItems,
    setSidebarOpen, setSidebarCollapsed, setSearchOpen, setNotificationsOpen, setProfileOpen,
    setInvestigationModalOpen, setStartInvestigationOnNetwork,
    setCaseFilter, setCaseHighRiskOnly, setSelectedCaseId, setSelectedSuspectId,
    setSelectedEvidenceId, setNetworkFocusEntity, setSelectedNetworkNode, setActiveCaseId,
    setNewCaseModalOpen, setLinkEvidenceModalOpen, setLinkEvidenceId,
    setActiveInvestigation,
    setAddEntityModalOpen, setAddRelationshipModalOpen,
    navigate, openStartInvestigation, createInvestigation,
    addCase, updateCaseStatus, addEntity, addRelationship, addIntelligence, addLocation, updateLocation, deleteLocation, addEvidence,
    runAIAnalysis, acceptSuggestion, rejectSuggestion,
    linkEvidence, dismissNotification, markNotificationsRead, updateSettings, showToast,
  }), [
    user, page, navigateTo, login, logout, activeView, sidebarOpen, sidebarCollapsed, searchOpen,
    notificationsOpen, profileOpen, investigationModalOpen, startInvestigationOnNetwork,
    cases, entities, relationships, intelligence, evidence, aiSuggestions, timeline, locations, investigations,
    activeInvestigation, activeCaseId, notifications, toasts, settings,
    caseFilter, caseHighRiskOnly, selectedCaseId, selectedSuspectId, selectedEvidenceId,
    networkFocusEntity, selectedNetworkNode,
    newCaseModalOpen, linkEvidenceModalOpen, linkEvidenceId,
    addEntityModalOpen, addRelationshipModalOpen,
    analyzing, analysisStep,
    unreadCount, navItems, navigate, openStartInvestigation, createInvestigation,
    addCase, updateCaseStatus, addEntity, addRelationship, addIntelligence, addLocation, updateLocation, deleteLocation, addEvidence,
    runAIAnalysis, acceptSuggestion, rejectSuggestion,
    linkEvidence, dismissNotification, markNotificationsRead, updateSettings, showToast,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
