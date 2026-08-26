import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  CASES as INITIAL_CASES,
  EVIDENCE as INITIAL_EVIDENCE,
  INITIAL_NOTIFICATIONS,
  SUSPECTS as INITIAL_SUSPECTS,
  INVESTIGATIONS as INITIAL_INVESTIGATIONS,
} from '../data/mockData'
import { getNavByRole } from '../data/users'
import { loadInvestigations, loadSettings, saveInvestigations, saveSettings, loadSession, saveSession } from '../utils/storage'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    const session = loadSession()
    return session?.user || null
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

  const [cases, setCases] = useState(INITIAL_CASES)
  const [suspects] = useState(INITIAL_SUSPECTS)
  const [evidence, setEvidence] = useState(INITIAL_EVIDENCE)
  const [investigations, setInvestigations] = useState(loadInvestigations().length > 0 ? loadInvestigations() : INITIAL_INVESTIGATIONS)
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

  const navItems = useMemo(() => getNavByRole(), [])

  const login = useCallback(async (name, email) => {
    const enrichedUser = {
      name: name || email.split('@')[0],
      email,
      role: 'investigator',
      roleKey: 'investigator',
      roleLabel: 'Investigator'
    }
    setUser(enrichedUser)
    saveSession({ user: enrichedUser, token: 'demo-token' })
    setPage('dashboard')
    return { user: enrichedUser }
  }, [])

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
      if (view === 'network') {
        setNetworkFocusEntity(options.suspectId)
      }
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
      const inv = {
        id: `INV-${Date.now()}`,
        ...data,
        createdAt: new Date().toISOString(),
      }
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
    (data) => {
      const newCase = {
        id: data.id || `NX-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
        title: data.title,
        priority: data.priority,
        status: 'Active',
        leadInvestigator: user?.name || 'Unassigned',
        entities: 0,
        lastUpdated: new Date().toISOString().slice(0, 10),
        risk: data.priority === 'CRITICAL' || data.priority === 'HIGH' ? 'HIGH' : data.priority,
        description: data.description || '',
        persons: [],
        evidence: [],
        timeline: [{ date: new Date().toISOString().slice(0, 10), event: 'Case opened' }],
      }
      setCases((prev) => [newCase, ...prev])
      setNewCaseModalOpen(false)
      showToast(`Case "${newCase.title}" created`)
      setSelectedCaseId(newCase.id)
    },
    [showToast, user],
  )

  const linkEvidence = useCallback(
    (evidenceId, caseId, personId) => {
      setEvidence((prev) =>
        prev.map((e) =>
          e.id === evidenceId ? { ...e, case: caseId, person: personId || e.person } : e,
        ),
      )
      setLinkEvidenceModalOpen(false)
      setLinkEvidenceId(null)
      showToast('Evidence linked successfully')
    },
    [showToast],
  )

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
    showToast('Settings saved')
  }, [showToast])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setNotificationsOpen(false)
        setProfileOpen(false)
        setInvestigationModalOpen(false)
        setNewCaseModalOpen(false)
        setLinkEvidenceModalOpen(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo(() => ({
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
    suspects,
    evidence,
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
    navigate,
    openStartInvestigation,
    createInvestigation,
    addCase,
    linkEvidence,
    dismissNotification,
    markNotificationsRead,
    updateSettings,
    showToast,
  }), [
    user, page, navigateTo, login, logout, activeView, sidebarOpen, sidebarCollapsed, searchOpen,
    notificationsOpen, profileOpen, investigationModalOpen, startInvestigationOnNetwork,
    cases, suspects, evidence, investigations, activeInvestigation, activeCaseId,
    notifications, toasts, settings, caseFilter, caseHighRiskOnly, selectedCaseId,
    selectedSuspectId, selectedEvidenceId, networkFocusEntity, selectedNetworkNode,
    newCaseModalOpen, linkEvidenceModalOpen, linkEvidenceId, unreadCount, navItems,
    navigate, openStartInvestigation, createInvestigation,
    addCase, linkEvidence, dismissNotification, markNotificationsRead, updateSettings, showToast,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
