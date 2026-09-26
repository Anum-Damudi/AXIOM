import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { INITIAL_NOTIFICATIONS, INVESTIGATIONS as INITIAL_INVESTIGATIONS } from '../data/mockData'
import { buildDemoData } from '../data/demoCase'
import { getNavByRole } from '../data/users'
import {
  loadInvestigations,
  loadSettings,
  saveInvestigations,
  saveSettings,
  loadSession,
  saveSession,
  loadCases,
  saveCases,
  loadEntities,
  saveEntities,
  loadRelationships,
  saveRelationships,
  loadIntelligence,
  saveIntelligence,
  loadAISuggestions,
  saveAISuggestions,
  loadCaseAnalysisSuggestions,
  saveCaseAnalysisSuggestions,
  loadDeniedCaseConnections,
  saveDeniedCaseConnections,
  loadAcceptedCaseConnections,
  saveAcceptedCaseConnections,
  loadTimeline,
  saveTimeline,
  loadLocations,
  saveLocations,
  loadEvidence,
  saveEvidence,
} from '../utils/storage'
import { buildCaseAnalysisSuggestions } from '../utils/caseAnalysis'
import { analyzeCase, simulateAnalysisProgress } from '../services/aiAnalysisService'
import { login as apiLogin } from '../services/authService'
import { API_BASE } from '../services/authService'
const AppContext = createContext(null)
const ROLE_META = {
  ADMIN: { roleKey: 'admin', roleLabel: 'Administrator' },
  INVESTIGATOR: { roleKey: 'investigator', roleLabel: 'Investigator' },
  OFFICER: { roleKey: 'officer', roleLabel: 'Officer' },
}
const PERSON_FIELDS = [
  'name', 'age', 'gender', 'height', 'weight', 'occupation', 'nationality',
  'address', 'phone', 'email', 'notes', 'aliases', 'risk', 'status', 'role',
]
const numericPersonFields = new Set(['age', 'height', 'weight'])
function personPayload(data = {}) {
  const payload = {}
  PERSON_FIELDS.forEach((field) => {
    if (data[field] === undefined) return
    const value = data[field] === '' ? null : data[field]
    payload[field] = numericPersonFields.has(field) && value !== null ? Number(value) : value
  })
  if (payload.role) payload.role = String(payload.role).toLowerCase()
  if (payload.risk) payload.risk = String(payload.risk).toUpperCase()
  if (payload.status) payload.status = String(payload.status).toUpperCase()
  return payload
}
function errorText(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((item) => item?.msg || item?.message || String(item)).join('; ')
  if (value && typeof value === 'object') return value.message || value.detail || JSON.stringify(value)
  return String(value || 'Request failed')
}

function personEntity(person, caseId, fallback = {}) {
  const role = String(person.role || fallback.role || 'suspect').toLowerCase()
  const photoPath = person.photo_path || fallback.photoPath || null
  return {
    ...fallback,
    id: person.id || fallback.id,
    backendId: person.id || fallback.backendId,
    caseId: caseId || fallback.caseId,
    type: 'Person',
    name: person.name || fallback.name || 'Unnamed person',
    role: role === 'suspect' ? 'Suspect' : role.charAt(0).toUpperCase() + role.slice(1),
    backendRole: role,
    age: person.age ?? fallback.age ?? null,
    gender: person.gender ?? fallback.gender ?? '',
    height: person.height ?? fallback.height ?? null,
    weight: person.weight ?? fallback.weight ?? null,
    occupation: person.occupation ?? fallback.occupation ?? '',
    nationality: person.nationality ?? fallback.nationality ?? '',
    address: person.address ?? fallback.address ?? '',
    phone: person.phone ?? fallback.phone ?? '',
    email: person.email ?? fallback.email ?? '',
    notes: person.notes ?? fallback.notes ?? fallback.description ?? '',
    aliases: person.aliases ?? fallback.aliases ?? '',
    photoPath,
    photo: photoPath,
    risk: String(person.risk || fallback.risk || 'MEDIUM').toUpperCase(),
    status: String(person.status || fallback.status || 'ACTIVE').toUpperCase(),
    description: person.notes ?? fallback.description ?? '',
    data: { ...(fallback.data || {}), ...person },
    createdAt: person.created_at || fallback.createdAt || new Date().toISOString(),
  }
}
function enrichUser(user) {
  const meta = ROLE_META[String(user.role || '').toUpperCase()] || ROLE_META.INVESTIGATOR
  return {
    id: user.id,
    name: user.displayName || user.name || user.full_name || user.username || user.email,
    email: user.email,
    username: user.username,
    role: meta.roleLabel,
    roleKey: meta.roleKey,
    roleLabel: meta.roleLabel,
    initials: (user.name || user.username || user.email || 'U').slice(0, 2).toUpperCase(),
    is_admin: String(user.role || '').toUpperCase() === 'ADMIN',
  }
}
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
      caseAnalysisSuggestions: loadCaseAnalysisSuggestions(),
      acceptedCaseConnections: loadAcceptedCaseConnections(),
      deniedCaseConnections: loadDeniedCaseConnections(),
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
    caseAnalysisSuggestions: [],
    acceptedCaseConnections: [],
    deniedCaseConnections: [],
    timeline: demo.timeline,
    locations: demo.locations,
  }
}
function backendStatus(value) {
  const status = String(value || '').toLowerCase()
  if (status === 'under investigation') return 'Under Investigation'
  if (status === 'closed') return 'Closed'
  if (status === 'open') return 'Open'
  return value || 'Open'
}
function backendPriority(value) {
  return String(value || 'medium').toUpperCase()
}
function backendCaseToLocal(item) {
  const priority = backendPriority(item.priority)
  const date = item.date || ''
  return {
    id: item.id,
    backendCaseId: item.id,
    title: item.title || item.id,
    type: item.case_type || 'Other',
    priority,
    status: backendStatus(item.status),
    leadInvestigator: item.investigating_officer || 'Unassigned',
    entities: 0,
    lastUpdated: String(item.updated_at || item.created_at || date).slice(0, 10),
    risk: priority,
    description: '',
    location: '',
    date,
    persons: [],
    evidence: [],
    timeline: [],
  }
}
function mergeBackendCases(localCases, backendItems) {
  const consumed = new Set()
  const merged = backendItems.map((item) => {
    const mapped = backendCaseToLocal(item)
    const index = localCases.findIndex((local) => {
      if (consumed.has(local.id)) return false
      return local.id === mapped.backendCaseId || local.backendCaseId === mapped.backendCaseId || local.title === mapped.title
    })
    if (index === -1) return mapped
    const existing = localCases[index]
    consumed.add(existing.id)
    return {
      ...existing,
      ...mapped,
      id: existing.id,
      description: existing.description || mapped.description,
      location: existing.location || mapped.location,
      persons: existing.persons?.length ? existing.persons : mapped.persons,
      evidence: existing.evidence?.length ? existing.evidence : mapped.evidence,
      timeline: existing.timeline?.length ? existing.timeline : mapped.timeline,
    }
  })
  return [...merged, ...localCases.filter((item) => !consumed.has(item.id))]
}
export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    const s = loadSession()
    return s?.user || null
  })
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
  const [caseAnalysisSuggestions, setCaseAnalysisSuggestions] = useState(initialData.caseAnalysisSuggestions)
  const [acceptedCaseConnections, setAcceptedCaseConnections] = useState(initialData.acceptedCaseConnections)
  const [deniedCaseConnections, setDeniedCaseConnections] = useState(initialData.deniedCaseConnections)
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
  const [suspectModalOpen, setSuspectModalOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState('')
  const navItems = useMemo(() => getNavByRole(user?.roleKey), [user?.roleKey])
  useEffect(() => {
    saveCases(cases)
  }, [cases])
  useEffect(() => {
    saveEntities(entities)
  }, [entities])
  useEffect(() => {
    saveRelationships(relationships)
  }, [relationships])
  useEffect(() => {
    saveIntelligence(intelligence)
  }, [intelligence])
  useEffect(() => {
    saveAISuggestions(aiSuggestions)
  }, [aiSuggestions])
  useEffect(() => {
    saveCaseAnalysisSuggestions(caseAnalysisSuggestions)
  }, [caseAnalysisSuggestions])
  useEffect(() => {
    saveAcceptedCaseConnections(acceptedCaseConnections)
  }, [acceptedCaseConnections])
  useEffect(() => {
    saveDeniedCaseConnections(deniedCaseConnections)
  }, [deniedCaseConnections])
  useEffect(() => {
    saveTimeline(timeline)
  }, [timeline])
  useEffect(() => {
    saveLocations(locations)
  }, [locations])
  useEffect(() => {
    saveEvidence(evidence)
  }, [evidence])
  const login = useCallback(
    async (identifier, password) => {
      const { token, user } = await apiLogin(identifier.trim(), password)
      const enrichedUser = enrichUser(user)
      setUser(enrichedUser)
      saveSession({ user: enrichedUser, token })
      setPage('dashboard')
      if (cases.length > 0 && !selectedCaseId) {
        setSelectedCaseId(cases[0].id)
        setActiveCaseId(cases[0].id)
      }
      return { user: enrichedUser }
    },
    [cases, selectedCaseId],
  )
  const logout = useCallback(() => {
    setUser(null)
    saveSession(null)
    setPage('landing')
    setActiveView('dashboard')
    setProfileOpen(false)
    setSelectedCaseId(null)
    setSelectedSuspectId(null)
    setSelectedEvidenceId(null)
    setSelectedNetworkNode(null)
    setActiveInvestigation(null)
    setActiveCaseId(null)
    setNotificationsOpen(false)
     setSearchOpen(false)
     setSuspectModalOpen(false)
   }, [])

  const navigateTo = useCallback((targetPage) => {
    setPage(targetPage)
  }, [])
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])
  const showToast = useCallback((message, type = 'success') => {
    const id = `toast-${Date.now()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])
  const syncWithBackend = useCallback(async (path, method = 'GET', payload = null, isFormData = false) => {
    let session = loadSession()
    let token = session?.token
    if (!token) {
      return { success: false, error: 'Authentication required. Please sign in again.' }
    }
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      }
      if (!isFormData) {
        headers['Content-Type'] = 'application/json'
      }
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: isFormData ? payload : payload ? JSON.stringify(payload) : undefined,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const errMsg = errorText(data?.detail || data?.message || data?.error || `Request failed with status ${response.status}`)
        console.error(`Backend request failed: ${method} ${path}`, { status: response.status, error: errMsg, data })
        if (response.status === 401) {
          saveSession(null)
          setUser(null)
        }
        return { success: false, error: errMsg, data: null }
      }
      return data
    } catch (e) {
      console.error('Network connection failed:', e)
      return { success: false, error: 'Network connection failed. Please ensure the backend is running.', data: null }
    }
  }, [])
  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    const hydrateBackendCases = async () => {
      const response = await syncWithBackend('/cases?limit=100')
      if (cancelled || !response?.success || !Array.isArray(response.data)) return
      setCases((prev) => mergeBackendCases(prev, response.data))
    }
    hydrateBackendCases()
    return () => { cancelled = true }
  }, [syncWithBackend, user?.id])
  const getBackendCaseId = useCallback(
    async (caseId) => {
      if (!caseId) return null
      if (!loadSession()?.token) return null
      const localCase = cases.find((item) => item.id === caseId)
      if (localCase?.backendCaseId) return localCase.backendCaseId
      if (String(caseId).startsWith('C')) return caseId

      const listResponse = await syncWithBackend(`/cases?limit=100&keyword=${encodeURIComponent(localCase?.title || caseId)}`)
      const matchingCase = listResponse?.data?.find((item) => item.id === caseId || item.title === localCase?.title)
      if (matchingCase?.id) {
        if (localCase) {
          setCases((prev) => prev.map((item) => item.id === caseId ? { ...item, backendCaseId: matchingCase.id } : item))
        }
        return matchingCase.id
      }

      if (!localCase) return null
      const createResponse = await syncWithBackend('/cases', 'POST', {
        title: localCase.title,
        date: localCase.date || new Date().toISOString().slice(0, 10),
        status: String(localCase.status || 'open').toLowerCase(),
        priority: String(localCase.priority || localCase.risk || 'medium').toLowerCase(),
        case_type: localCase.type || 'Criminal Investigation',
        investigating_officer: localCase.leadInvestigator || user?.name || null,
      })
      if (!createResponse?.data?.id) return null
      setCases((prev) => prev.map((item) => item.id === caseId ? { ...item, backendCaseId: createResponse.data.id } : item))
      return createResponse.data.id
    },
    [cases, setCases, syncWithBackend, user?.name],
  )
  const uploadUrl = useCallback((path) => {
    if (!path) return null
    return path.startsWith('/')
      ? `${API_BASE.replace(/\/api\/v1$/, '')}${path}`
      : `${API_BASE.replace(/\/api\/v1$/, '')}/uploads/${path}`
  }, [])
  const createSuspect = useCallback(
    async (data) => {
      const response = await syncWithBackend('/people', 'POST', personPayload({ ...data, role: 'suspect' }))
      const person = response?.data
      if (!person && response?.error && !errorText(response.error).toLowerCase().includes('network')) {
        showToast(response.error, 'error')
        return null
      }

      const backendCaseId = person ? await getBackendCaseId(data.caseId) : null
      let linked = false
      if (person && backendCaseId) {
        const linkResponse = await syncWithBackend(`/cases/${encodeURIComponent(backendCaseId)}/entities`, 'POST', {
          type: 'person',
          entity_id: person.id,
          name: person.name,
          role: 'suspect',
        })
        linked = Boolean(linkResponse?.success)
      }

      const entity = person
        ? personEntity(person, data.caseId, {
            ...data,
            id: person.id,
            backendId: person.id,
            risk: data.risk || person.risk,
            description: data.description || data.notes,
          })
        : {
            ...data,
            id: data.id || `ENT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            backendId: null,
            type: 'Person',
            role: 'Suspect',
            risk: String(data.risk || 'MEDIUM').toUpperCase(),
            status: String(data.status || 'ACTIVE').toUpperCase(),
            description: data.notes || data.description || '',
            createdAt: new Date().toISOString(),
          }

      setEntities((prev) => {
        const existingIndex = prev.findIndex((item) => item.caseId === data.caseId && item.id === entity.id)
        if (existingIndex === -1) return [entity, ...prev]
        return prev.map((item, index) => index === existingIndex ? { ...item, ...entity } : item)
      })
      setTimeline((prev) => [{
        id: `tl-${Date.now()}`,
        caseId: data.caseId,
        date: new Date().toISOString().slice(0, 10),
        event: `Suspect added: ${entity.name}`,
        type: 'ENTITY_ADDED',
        entityId: entity.id,
        createdAt: new Date().toISOString(),
      }, ...prev])
      setSelectedSuspectId(entity.id)
      if (!person) showToast('Suspect saved in the local workspace', 'info')
      else if (!linked) showToast('Suspect saved; case link is awaiting backend confirmation', 'info')
      else showToast(`Suspect "${entity.name}" saved`)
      return { ...entity, persistence: person ? (linked ? 'backend' : 'person') : 'local' }
    },
    [getBackendCaseId, showToast, syncWithBackend],
  )
  const updateSuspect = useCallback(
    async (suspectId, data) => {
      const current = entities.find((entity) => entity.id === suspectId)
      if (!current) return null
      const response = current.backendId
        ? await syncWithBackend(`/people/${encodeURIComponent(current.backendId)}`, 'PATCH', personPayload({ ...current, ...data, role: 'suspect' }))
        : { success: true, data: null }
      const person = response?.data
      if (!person && response?.error && !errorText(response.error).toLowerCase().includes('network')) {
        showToast(response.error, 'error')
        return null
      }
      const updated = person
        ? personEntity(person, current.caseId, { ...current, ...data })
        : { ...current, ...data, role: 'Suspect', risk: String(data.risk || current.risk || 'MEDIUM').toUpperCase() }
      setEntities((prev) => prev.map((entity) => entity.id === suspectId ? { ...entity, ...updated } : entity))
      setSelectedSuspectId(suspectId)
      showToast(`Suspect "${updated.name}" updated`)
      return updated
    },
    [entities, showToast, syncWithBackend],
  )
  const deleteSuspect = useCallback(
    async (suspectId) => {
      const current = entities.find((entity) => entity.id === suspectId)
      if (!current) return false
      if (current.backendId) {
        const response = await syncWithBackend(`/people/${encodeURIComponent(current.backendId)}`, 'DELETE')
        if (!response?.success && response?.error && !errorText(response.error).toLowerCase().includes('not found')) {
          showToast(response.error, 'error')
          return false
        }
      }
      setEntities((prev) => prev.filter((entity) => !(entity.id === suspectId && entity.caseId === current.caseId)))
      setRelationships((prev) => prev.filter((relationship) => relationship.fromId !== suspectId && relationship.toId !== suspectId))
      setSelectedSuspectId(null)
      showToast(`Suspect "${current.name}" deleted`)
      return true
    },
     [entities, showToast, syncWithBackend],

  )
  const uploadSuspectPhoto = useCallback(
    async (suspectId, file, entityOverride = null) => {
      if (!file) return null
      if (!file.type.startsWith('image/')) {
        showToast('Select an image file for the suspect photo', 'error')
        return null
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Suspect photos must be 5 MB or smaller', 'error')
        return null
      }
      const current = entityOverride || entities.find((entity) => entity.id === suspectId)
      if (!current) return null
      if (!current.backendId) {
        const preview = URL.createObjectURL(file)
        setEntities((prev) => prev.map((entity) => entity.id === suspectId ? { ...entity, photo: preview, photoPath: preview } : entity))
        showToast('Photo attached to the local workspace', 'info')
        return preview
      }
      const formData = new FormData()
      formData.append('file', file)
      const response = await syncWithBackend(`/people/${encodeURIComponent(current.backendId)}/photo`, 'POST', formData, true)
      if (!response?.success) {
        showToast(response?.error || 'Photo upload failed', 'error')
        return null
      }
      const photoPath = response.data?.photo_path || null
      setEntities((prev) => prev.map((entity) => entity.id === suspectId ? { ...entity, photoPath, photo: photoPath } : entity))
      showToast('Suspect photo updated')
      return response.data
    },
    [entities, showToast, syncWithBackend],
  )
  const navigate = useCallback((view, options = {}) => {
    setActiveView(view)
    setSidebarOpen(false)
    setSearchOpen(false)
    setProfileOpen(false)
    if (options.filter === 'highRisk') {
      setCaseHighRiskOnly(true)
      setCaseFilter('')
    } else if (view !== 'cases') {
      setCaseHighRiskOnly(false)
    }
    if (options.caseId) {
      setSelectedCaseId(options.caseId)
      setActiveCaseId(options.caseId)
    }
    if (options.suspectId) {
      setSelectedSuspectId(options.suspectId)
      if (view === 'network') setNetworkFocusEntity(options.suspectId)
    }
    if (options.openAddSuspect) {
      setSuspectModalOpen(true)
    } else {
      setSuspectModalOpen(false)
    }
    if (options.evidenceId) {
      setSelectedEvidenceId(options.evidenceId)
    }
    if (options.openInvestigation) {
      setStartInvestigationOnNetwork(true)
    }
    if (options.networkNode) {
      setSelectedNetworkNode(options.networkNode)
    }
  }, [])
  const openStartInvestigation = useCallback(() => {
    setInvestigationModalOpen(true)
  }, [])
  const createInvestigation = useCallback(
    (data) => {
      const inv = { id: `INV-${Date.now()}`, ...data, createdAt: new Date().toISOString() }
      const updated = [inv, ...investigations]
      setInvestigations(updated)
      saveInvestigations(updated)
      setActiveInvestigation(inv)
      setInvestigationModalOpen(false)
      setStartInvestigationOnNetwork(true)
      navigate('network')
      showToast(`Investigation "${data.name}" created successfully`)
    },
    [investigations, navigate, showToast],
  )
  const addCase = useCallback(
    async (data) => {
      const id = data.id || `NX-2026-${String(Math.floor(Math.random() * 900) + 100)}`
      const newCase = {
        id,
        title: data.title,
        type: data.type || 'Other',
        priority: data.priority || 'MEDIUM',
        status: 'Active',
        leadInvestigator: user?.name || 'Unassigned',
        entities: 0,
        lastUpdated: new Date().toISOString().slice(0, 10),
        risk: data.priority === 'CRITICAL' || data.priority === 'HIGH' ? 'HIGH' : data.priority || 'MEDIUM',
        description: data.description || '',
        location: data.location || '',
        date: data.date || new Date().toISOString().slice(0, 10),
        persons: [],
        evidence: [],
        timeline: [{ date: new Date().toISOString().slice(0, 10), event: 'Case opened', type: 'CASE_EVENT' }],
      }
      setCases((prev) => [newCase, ...prev])
      setNewCaseModalOpen(false)
      showToast(`Case "${newCase.title}" created`)
      setSelectedCaseId(newCase.id)
      setActiveCaseId(newCase.id)
      setActiveInvestigation({
        id: `INV-${Date.now()}`,
        name: newCase.title,
        caseId: newCase.id,
        priority: newCase.priority,
        type: newCase.type,
        status: 'Active',
        createdAt: new Date().toISOString(),
      })
      const tlEntry = {
        id: `tl-${Date.now()}`,
        caseId: newCase.id,
        date: new Date().toISOString().slice(0, 10),
        event: 'Case opened',
        type: 'CASE_EVENT',
        createdAt: new Date().toISOString(),
      }
      setTimeline((prev) => [tlEntry, ...prev])
      const backendCase = await syncWithBackend('/cases', 'POST', {
        title: newCase.title,
        date: newCase.date,
        status: 'open',
        priority: String(newCase.priority).toLowerCase(),
        case_type: newCase.type || 'Criminal Investigation',
        investigating_officer: newCase.leadInvestigator || 'Officer Inspector',
      })
      if (backendCase?.data?.id) {
        setCases((prev) => prev.map((c) => (c.id === newCase.id ? { ...c, backendCaseId: backendCase.data.id } : c)))
      }
      return newCase
    },
    [showToast, syncWithBackend, user],
  )
  const updateCaseStatus = useCallback(
    (caseId, status) => {
      setCases((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, status, lastUpdated: new Date().toISOString().slice(0, 10) } : c)),
      )
      showToast(`Case status updated to ${status}`)
    },
    [showToast],
  )
  const addEntity = useCallback(
    async (data) => {
      if (String(data.type || '').toLowerCase() === 'person' && String(data.role || '').toLowerCase() === 'suspect') {
        return createSuspect(data)
      }
      const entity = {
        id: data.id || `ENT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        caseId: data.caseId,
        type: data.type,
        name: data.name,
        risk: data.risk || 'LOW',
        role: data.role || '',
        description: data.description || '',
        data: data.data || {},
        createdAt: new Date().toISOString(),
      }
      setEntities((prev) => [...prev, entity])
      const tlEntry = {
        id: `tl-${Date.now()}`,
        caseId: data.caseId,
        date: new Date().toISOString().slice(0, 10),
        event: `Entity added: ${entity.name} (${entity.type})`,
        type: 'ENTITY_ADDED',
        entityId: entity.id,
        createdAt: new Date().toISOString(),
      }
      setTimeline((prev) => [tlEntry, ...prev])
      showToast(`Entity "${entity.name}" added`)
      const caseRecord = cases.find((c) => c.id === data.caseId)
      const backendCaseId = caseRecord?.backendCaseId || data.caseId
      if (backendCaseId) {
        const requestType = String(data.type || 'person').toLowerCase()
        const backendPayload = {
          type: requestType,
          name: data.name,
          role: data.role || 'associate',
          age: data.age || null,
          plate_number: data.plateNumber || data.plate_number || null,
        }
        await syncWithBackend(`/cases/${backendCaseId}/entities`, 'POST', backendPayload)
      }
      return entity
    },
    [cases, createSuspect, showToast, syncWithBackend],
  )
  const addRelationship = useCallback(
    (data) => {
      if (data.fromId === data.toId) {
        showToast('Cannot create self-relationship', 'error')
        return null
      }
      const fromEntity = entities.find((e) => e.id === data.fromId)
      const toEntity = entities.find((e) => e.id === data.toId)
      const rel = {
        id: data.id || `REL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        caseId: data.caseId,
        fromId: data.fromId,
        toId: data.toId,
        type: data.type || 'CONNECTED_TO',
        label: data.label || '',
        status: 'MANUAL',
        createdAt: new Date().toISOString(),
      }
      setRelationships((prev) => [...prev, rel])
      const tlEntry = {
        id: `tl-${Date.now()}`,
        caseId: data.caseId,
        date: new Date().toISOString().slice(0, 10),
        event: `Relationship added: ${fromEntity?.name || data.fromId} → ${toEntity?.name || data.toId}`,
        type: 'RELATIONSHIP_CONFIRMED',
        createdAt: new Date().toISOString(),
      }
      setTimeline((prev) => [tlEntry, ...prev])
      showToast('Relationship added')
      return rel
    },
    [entities, showToast],
  )
  const addIntelligence = useCallback(
    (data) => {
      const item = {
        id: `INT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        caseId: data.caseId,
        text: data.text || data.description || '',
        source: data.source || 'Field Report',
        date: data.date || new Date().toISOString().slice(0, 10),
        relatedEntityIds: data.relatedEntityIds || data.entityIds || [],
        createdAt: new Date().toISOString(),
      }
      setIntelligence((prev) => [item, ...prev])
      const tlEntry = {
        id: `tl-${Date.now()}`,
        caseId: data.caseId,
        date: item.date,
        event: `Intelligence added: ${(item.text || '').slice(0, 60)}...`,
        type: 'INTELLIGENCE_ADDED',
        createdAt: new Date().toISOString(),
      }
      setTimeline((prev) => [tlEntry, ...prev])
      showToast('Intelligence added')
      return item
    },
    [showToast],
  )
  const addLocation = useCallback(
    (data) => {
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
      setLocations((prev) => [...prev, loc])
      const tlEntry = {
        id: `tl-${Date.now()}`,
        caseId: data.caseId,
        date: new Date().toISOString().slice(0, 10),
        event: `Location recorded: ${loc.name}`,
        type: 'LOCATION_RECORDED',
        locationId: loc.id,
        createdAt: new Date().toISOString(),
      }
      setTimeline((prev) => [tlEntry, ...prev])
      showToast(`Location "${loc.name}" recorded`)
      return loc
    },
    [showToast],
  )
  const updateLocation = useCallback(
    (locationId, updates) => {
      setLocations((prev) => prev.map((loc) => (loc.id === locationId ? { ...loc, ...updates } : loc)))
      showToast('Location updated')
    },
    [showToast],
  )
  const deleteLocation = useCallback(
    (locationId) => {
      const loc = locations.find((l) => l.id === locationId)
      setLocations((prev) => prev.filter((loc) => loc.id !== locationId))
      showToast(loc ? `Location "${loc.name}" deleted` : 'Location deleted')
    },
    [locations, showToast],
  )
  const addEvidence = useCallback(
    (data) => {
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
      setEvidence((prev) => [item, ...prev])
      const entity = item.relatedEntityId ? entities.find((e) => e.id === item.relatedEntityId) : null
      const tlEntry = {
        id: `tl-${Date.now()}`,
        caseId: data.caseId,
        date: item.date,
        event: `Evidence added: ${item.title}${entity ? ` (Related: ${entity.name})` : ''}`,
        type: 'EVIDENCE_ADDED',
        createdAt: new Date().toISOString(),
      }
      setTimeline((prev) => [tlEntry, ...prev])
      showToast(`Evidence "${item.title}" added`)
      return item
    },
    [entities, showToast],
  )
  const runAIAnalysis = useCallback(
    async (caseId) => {
      const caseEntities = entities.filter((e) => e.caseId === caseId)
      const caseIntel = intelligence.filter((i) => i.caseId === caseId)
      const caseLocations = locations.filter((l) => l.caseId === caseId)
      if (caseEntities.length < 2) {
        showToast('Need at least 2 entities to run analysis', 'error')
        return []
      }
      setAnalyzing(true)
      await simulateAnalysisProgress((msg) => setAnalysisStep(msg))
      const suggestions = analyzeCase(caseEntities, caseIntel, caseLocations)
      const suggestionsWithCase = suggestions.map((s) => ({ ...s, caseId }))
      setAISuggestions((prev) => {
        const filtered = prev.filter((s) => s.caseId !== caseId || s.status !== 'PENDING')
        return [...filtered, ...suggestionsWithCase]
      })
      const tlEntry = {
        id: `tl-${Date.now()}`,
        caseId,
        date: new Date().toISOString().slice(0, 10),
        event: `AI analysis completed — ${suggestionsWithCase.length} potential relationships identified`,
        type: 'AI_ANALYSIS',
        createdAt: new Date().toISOString(),
      }
      setTimeline((prev) => [tlEntry, ...prev])
      setAnalyzing(false)
      setAnalysisStep('')
      showToast(`AI analysis complete — ${suggestionsWithCase.length} suggestions found`)
      return suggestionsWithCase
    },
    [entities, intelligence, locations, showToast],
  )
  const runCaseAnalysis = useCallback(
    async (caseId) => {
      const currentCase = cases.find((c) => c.id === caseId)
      if (!currentCase) return []
      const suggestions = buildCaseAnalysisSuggestions(caseId, cases, entities, deniedCaseConnections)
      setCaseAnalysisSuggestions((prev) => {
        const filtered = prev.filter((existing) => existing.caseId !== caseId || existing.status !== 'PENDING')
        return [...filtered, ...suggestions]
      })
      if (suggestions.length === 0) {
        showToast('No significant connections found with existing cases.', 'info')
        return []
      }
      showToast(`Found ${suggestions.length} potential case connection${suggestions.length === 1 ? '' : 's'}.`)
      return suggestions
    },
    [cases, deniedCaseConnections, entities, showToast],
  )
  const acceptCaseConnection = useCallback(
    (suggestionId) => {
      const suggestion = caseAnalysisSuggestions.find((s) => s.id === suggestionId)
      if (!suggestion) return
      setCaseAnalysisSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
      setAcceptedCaseConnections((prev) => {
        const key = `${suggestion.caseId}:${suggestion.targetCaseId}:${suggestion.connectionType}:${suggestion.commonInfo}`
        if (
          prev.some((item) => `${item.caseId}:${item.targetCaseId}:${item.connectionType}:${item.commonInfo}` === key)
        )
          return prev
        return [
          {
            id: suggestion.id,
            caseId: suggestion.caseId,
            targetCaseId: suggestion.targetCaseId,
            targetCaseTitle: suggestion.targetCaseTitle,
            connectionType: suggestion.connectionType,
            commonInfo: suggestion.commonInfo,
            sharedEntities: suggestion.sharedEntities || [],
            confidence: suggestion.confidence,
            reason: suggestion.reason,
            acceptedAt: new Date().toISOString(),
          },
          ...prev,
        ]
      })
      showToast(`Connection accepted: ${suggestion.targetCaseTitle}`)
    },
    [caseAnalysisSuggestions, showToast],
  )
  const denyCaseConnection = useCallback(
    (suggestionId) => {
      const suggestion = caseAnalysisSuggestions.find((s) => s.id === suggestionId)
      if (!suggestion) return
      setCaseAnalysisSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
      setDeniedCaseConnections((prev) => {
        const key = `${suggestion.caseId}:${suggestion.targetCaseId}:${suggestion.connectionType}:${suggestion.commonInfo}`
        if (
          prev.some((item) => `${item.caseId}:${item.targetCaseId}:${item.connectionType}:${item.commonInfo}` === key)
        )
          return prev
        return [
          {
            caseId: suggestion.caseId,
            targetCaseId: suggestion.targetCaseId,
            connectionType: suggestion.connectionType,
            commonInfo: suggestion.commonInfo,
            sharedEntities: suggestion.sharedEntities || [],
            deniedAt: new Date().toISOString(),
          },
          ...prev,
        ]
      })
      showToast('Suggestion denied', 'info')
    },
    [caseAnalysisSuggestions, showToast],
  )
  const acceptSuggestion = useCallback(
    (suggestionId) => {
      setAISuggestions((prev) => prev.map((s) => (s.id === suggestionId ? { ...s, status: 'ACCEPTED' } : s)))
      const suggestion = aiSuggestions.find((s) => s.id === suggestionId)
      if (suggestion) {
        const rel = {
          id: `REL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          caseId: suggestion.caseId,
          fromId: suggestion.fromId,
          toId: suggestion.toId,
          type: suggestion.type,
          label: suggestion.reason?.slice(0, 80) || '',
          status: 'AI_CONFIRMED',
          confidence: suggestion.confidence,
          createdAt: new Date().toISOString(),
        }
        setRelationships((prev) => [...prev, rel])
        const tlEntry = {
          id: `tl-${Date.now()}`,
          caseId: suggestion.caseId,
          date: new Date().toISOString().slice(0, 10),
          event: `Relationship confirmed: ${suggestion.fromName} → ${suggestion.toName} (${suggestion.confidence}% confidence)`,
          type: 'RELATIONSHIP_CONFIRMED',
          createdAt: new Date().toISOString(),
        }
        setTimeline((prev) => [tlEntry, ...prev])
        showToast(`Relationship accepted: ${suggestion.fromName} → ${suggestion.toName}`)
      }
    },
    [aiSuggestions, showToast],
  )
  const rejectSuggestion = useCallback(
    (suggestionId) => {
      setAISuggestions((prev) => prev.map((s) => (s.id === suggestionId ? { ...s, status: 'REJECTED' } : s)))
      showToast('Suggestion rejected', 'info')
    },
    [showToast],
  )
  const linkEvidence = useCallback(() => {
    setLinkEvidenceModalOpen(false)
    setLinkEvidenceId(null)
    showToast('Evidence linked successfully')
  }, [showToast])
  const importCDR = useCallback(
    async (caseId, file, operator) => {
      const formData = new FormData()
      formData.append('file', file)
      if (operator) formData.append('operator', operator)
      const response = await syncWithBackend(`/cases/${caseId}/cdr/import`, 'POST', formData, true)
      if (response?.data) {
        showToast('CDR data imported and analyzed successfully')
        return response.data
      }
      const errMsg = response?.error || 'CDR import failed. Please check file format.'
      showToast(errMsg, 'error')
      return null
    },
    [syncWithBackend, showToast],
  )
  const getPhoneProfile = useCallback(
    async (phoneNumber) => {
      const response = await syncWithBackend(`/phones/${phoneNumber}/profile`)
      return response?.data || null
    },
    [syncWithBackend],
  )
  const getPhoneIntelligence = useCallback(
    async (caseId) => {
      if (!caseId) return null
      const response = await syncWithBackend(`/cases/${caseId}/phone-intelligence`)
      return response?.data || null
    },
    [syncWithBackend],
  )
  const verifyChain = useCallback(async () => {
    const response = await syncWithBackend('/ledger/verify')
    return response?.data || null
  }, [syncWithBackend])
  const verifyEvidence = useCallback(
    async (evidenceId) => {
      if (!evidenceId) return null
      const response = await syncWithBackend(`/evidence/${evidenceId}/verify`)
      return response?.data || null
    },
    [syncWithBackend],
  )
  const getLedgerSummary = useCallback(async () => {
    const response = await syncWithBackend('/ledger/summary')
    return response?.data || null
  }, [syncWithBackend])
  const getLedgerEntries = useCallback(
    async (caseId = null) => {
      const path = caseId ? `/ledger/entries?case_id=${caseId}` : '/ledger/entries'
      const response = await syncWithBackend(path)
      return response?.data || []
    },
    [syncWithBackend],
  )
  const getLedgerBlocks = useCallback(async () => {
    const response = await syncWithBackend('/ledger/blocks')
    return response?.data || []
  }, [syncWithBackend])
  const sealLedgerBlock = useCallback(
    async (sealedBy = 'investigator') => {
      const response = await syncWithBackend('/ledger/seal', 'POST', { sealed_by: sealedBy })
      if (response?.data) {
        showToast('Block sealed successfully')
        return response.data
      }
      showToast(response?.error || 'Failed to seal block', 'error')
      return null
    },
    [syncWithBackend, showToast],
  )
  const fetchCaseEvidence = useCallback(
    async (caseId) => {
      if (!caseId) return []
      try {
        const backendCaseId = await getBackendCaseId(caseId)
        if (!backendCaseId) return []
        const response = await syncWithBackend(`/cases/${encodeURIComponent(backendCaseId)}/evidence`)
        if (response?.success && response?.data && Array.isArray(response.data)) {
          const backendItems = response.data.map((item) => ({
            id: item.id,
            caseId: item.case_id,
            title: item.title,
            type: item.evidence_type || 'Document',
            description: item.description || '',
            date: item.date || (item.created_at ? item.created_at.slice(0, 10) : ''),
            source: item.source || 'Field Investigation',
            status: item.status || 'Pending',
            relatedEntityId: item.related_entity_id,
            sha256: item.sha256,
            fileName: item.file_name,
            filePath: item.file_path,
            createdAt: item.created_at,
          }))
          setEvidence((prev) => {
            const others = prev.filter((e) => e.caseId !== caseId)
            return [...others, ...backendItems]
          })
          return backendItems
        } else if (response?.error) {
          console.error('Failed to fetch evidence:', response.error)
          // Don't show toast for expected errors like no case found
          if (!response.error.includes('not found') && !response.error.includes('Case')) {
            showToast(`Failed to fetch evidence: ${response.error}`, 'error')
          }
        }
      } catch (e) {
        console.error('Error fetching evidence:', e)
        showToast('Network error while fetching evidence', 'error')
      }
      return []
    },
    [syncWithBackend, showToast],
  )
  const fetchCaseEntities = useCallback(
    async (caseId) => {
      if (!caseId) return []
      try {
        const backendCaseId = await getBackendCaseId(caseId)
        if (!backendCaseId) return []
        const response = await syncWithBackend(`/cases/${encodeURIComponent(backendCaseId)}/entities`)
        if (response?.success && response?.data && Array.isArray(response.data)) {
          const backendEntities = response.data.map((item) => {
            if (item.type === 'Person') {
              return personEntity(item, caseId, { id: item.id, backendId: item.id })
            }
            return {
              id: item.id,
              caseId,
              name: item.name,
              type: item.type,
              role: item.role,
              risk: item.risk || 'MEDIUM',
            }
          })
          setEntities((prev) => {
            const current = prev.filter((entity) => entity.caseId === caseId)
            const backendIds = new Set(backendEntities.map((entity) => entity.id))
            return [...backendEntities, ...current.filter((entity) => !backendIds.has(entity.id))]
          })
          return backendEntities
        }
      } catch (error) {
        console.error('Error fetching entities:', error)
      }
      return []
    },
    [getBackendCaseId, syncWithBackend],
  )
  useEffect(() => {
    if (!selectedCaseId) return
    const frame = window.requestAnimationFrame(() => {
      fetchCaseEvidence(selectedCaseId)
      fetchCaseEntities(selectedCaseId)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedCaseId, fetchCaseEvidence, fetchCaseEntities])
  const batchUploadEvidence = useCallback(
    async (caseId, files) => {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      try {
        const response = await syncWithBackend(`/cases/${caseId}/evidence/batch`, 'POST', formData, true)
        if (response?.success && response?.data) {
          showToast(`Uploaded ${response.data.successful || 0} files successfully`)
          await fetchCaseEvidence(caseId)
          return response.data
        } else {
          const errorMsg = response?.error || 'Batch upload failed'
          console.error('Batch upload failed:', errorMsg)
          showToast(errorMsg, 'error')
          return null
        }
      } catch (e) {
        console.error('Batch upload error:', e)
        showToast('Network error during batch upload', 'error')
        return null
      }
    },
    [syncWithBackend, showToast, fetchCaseEvidence],
  )
  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])
  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])
  const updateSettings = useCallback(
    (patch) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        saveSettings(next)
        return next
      })
      showToast('Settings saved')
    },
    [showToast],
  )
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setNotificationsOpen(false)
        setProfileOpen(false)
        setInvestigationModalOpen(false)
        setNewCaseModalOpen(false)
        setLinkEvidenceModalOpen(false)
        setAddEntityModalOpen(false)
        setAddRelationshipModalOpen(false)
        setSuspectModalOpen(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      page,
      navigateTo,
      login,
      logout,
      activeView,
      sidebarOpen,
      sidebarCollapsed,
      searchOpen,
      notificationsOpen,
      profileOpen,
      investigationModalOpen,
      startInvestigationOnNetwork,
      cases,
      entities,
      relationships,
      intelligence,
      evidence,
      aiSuggestions,
      caseAnalysisSuggestions,
      acceptedCaseConnections,
      deniedCaseConnections,
      timeline,
      locations,
      investigations,
      activeInvestigation,
      activeCaseId,
      notifications,
      toasts,
      settings,
      caseFilter,
      caseHighRiskOnly,
      selectedCaseId,
      selectedSuspectId,
      selectedEvidenceId,
      networkFocusEntity,
      selectedNetworkNode,
      newCaseModalOpen,
      linkEvidenceModalOpen,
      linkEvidenceId,
      addEntityModalOpen,
      addRelationshipModalOpen,
      suspectModalOpen,
      analyzing,
      analysisStep,
      unreadCount,
      navItems,
      setSidebarOpen,
      setSidebarCollapsed,
      setSearchOpen,
      setNotificationsOpen,
      setProfileOpen,
      setInvestigationModalOpen,
      setStartInvestigationOnNetwork,
      setCaseFilter,
      setCaseHighRiskOnly,
      setSelectedCaseId,
      setSelectedSuspectId,
      setSelectedEvidenceId,
      setNetworkFocusEntity,
      setSelectedNetworkNode,
      setActiveCaseId,
      setNewCaseModalOpen,
      setLinkEvidenceModalOpen,
      setLinkEvidenceId,
      setActiveInvestigation,
       setAddEntityModalOpen,
       setAddRelationshipModalOpen,
       setSuspectModalOpen,
       navigate,

      openStartInvestigation,
      createInvestigation,
      addCase,
      updateCaseStatus,
       addEntity,
       createSuspect,
       updateSuspect,
       deleteSuspect,
       uploadSuspectPhoto,
       addRelationship,

      addIntelligence,
      addLocation,
      updateLocation,
      deleteLocation,
      addEvidence,
      runAIAnalysis,
      runCaseAnalysis,
      acceptCaseConnection,
      denyCaseConnection,
      acceptSuggestion,
      rejectSuggestion,
      linkEvidence,
      dismissNotification,
      markNotificationsRead,
      updateSettings,
      showToast,
      importCDR,
      getPhoneProfile,
      verifyChain,
      batchUploadEvidence,
      syncWithBackend,
      fetchCaseEvidence,
      fetchCaseEntities,
      getPhoneIntelligence,
      verifyEvidence,
      getLedgerSummary,
      getLedgerEntries,
      getLedgerBlocks,
      sealLedgerBlock,
      uploadUrl,
    }),
    [
      user,
      page,
      navigateTo,
      login,
      logout,
      activeView,
      sidebarOpen,
      sidebarCollapsed,
      searchOpen,
      notificationsOpen,
      profileOpen,
      investigationModalOpen,
      startInvestigationOnNetwork,
      cases,
      entities,
      relationships,
      intelligence,
      evidence,
      aiSuggestions,
      caseAnalysisSuggestions,
      acceptedCaseConnections,
      deniedCaseConnections,
      timeline,
      locations,
      investigations,
      activeInvestigation,
      activeCaseId,
      notifications,
      toasts,
      settings,
      caseFilter,
      caseHighRiskOnly,
      selectedCaseId,
      selectedSuspectId,
      selectedEvidenceId,
      networkFocusEntity,
      selectedNetworkNode,
      newCaseModalOpen,
      linkEvidenceModalOpen,
      linkEvidenceId,
      addEntityModalOpen,
      addRelationshipModalOpen,
      suspectModalOpen,
      analyzing,
      analysisStep,
      unreadCount,
      navItems,
      navigate,
      openStartInvestigation,
      createInvestigation,
      addCase,
      updateCaseStatus,
       addEntity,
       createSuspect,
       updateSuspect,
       deleteSuspect,
       uploadSuspectPhoto,
       addRelationship,

      addIntelligence,
      addLocation,
      updateLocation,
      deleteLocation,
      addEvidence,
      runAIAnalysis,
      runCaseAnalysis,
      acceptCaseConnection,
      denyCaseConnection,
      acceptSuggestion,
      rejectSuggestion,
      linkEvidence,
      dismissNotification,
      markNotificationsRead,
      updateSettings,
      showToast,
      importCDR,
      getPhoneProfile,
      verifyChain,
      batchUploadEvidence,
      syncWithBackend,
      fetchCaseEvidence,
      fetchCaseEntities,
      getPhoneIntelligence,
      verifyEvidence,
      getLedgerSummary,
      getLedgerEntries,
      getLedgerBlocks,
      sealLedgerBlock,
      uploadUrl,
    ],
  )
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
