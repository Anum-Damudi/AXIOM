import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import SearchOverlay from './components/SearchOverlay'
import NotificationPanel from './components/NotificationPanel'
import ProfileDropdown from './components/ProfileDropdown'
import ToastContainer from './components/Toast'
import InvestigationModal, { NewCaseModal } from './components/InvestigationModal'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NetworkAnalysis from './pages/NetworkAnalysis'
import Cases from './pages/Cases'
import Suspects from './pages/Suspects'
import Evidence from './pages/Evidence'
import Settings from './pages/Settings'
import Intelligence from './pages/Intelligence'
import Reports from './pages/Reports'
import MapView from './pages/MapView'
import Analytics from './pages/Analytics'
import Phones from './pages/Phones'
import Ledger from './pages/Ledger'
import AccessRestricted from './pages/AccessRestricted'
import AuroraBackground from './components/background/AuroraBackground'
import './App.css'

// Views that require write/administrative privilege (outside OFFICER read-only scope).
const PRIVILEGED_VIEWS = new Set(['ledger', 'settings'])

function AppContent() {
  const {
    isAuthenticated, page, activeView, investigationModalOpen, setInvestigationModalOpen,
    createInvestigation, toasts, settings, newCaseModalOpen, setNewCaseModalOpen, addCase,
    user, navigate,
  } = useApp()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark')
  }, [settings.theme])

  if (page === 'landing') return <><LandingPage /><ToastContainer toasts={toasts} /></>
  if (page === 'login' || !isAuthenticated) return <><Login /><ToastContainer toasts={toasts} /></>

  const isOfficer = user?.roleKey === 'officer'

  const hasAccess = (view) => {
    if (!isOfficer) return true
    return !PRIVILEGED_VIEWS.has(view)
  }

  const renderPage = () => {
    if (!hasAccess(activeView)) {
      return <AccessRestricted onBack={() => navigate('dashboard')} />
    }
    switch (activeView) {
      case 'network': return <NetworkAnalysis />
      case 'cases': return <Cases />
      case 'suspects': return <Suspects />
      case 'evidence': return <Evidence />
      case 'phones': return <Phones />
      case 'intelligence': return <Intelligence />
      case 'ledger': return <Ledger />
      case 'reports': return <Reports />
      case 'map': return <MapView />
      case 'analytics': return <Analytics />
      case 'settings': return <Settings />
      default: return <Dashboard />
    }
  }

  return (
    <div className="app">
      <AuroraBackground />
      <div className="aurora-overlay" aria-hidden="true" />
      <Sidebar />
      <div className="main">
        <TopBar />
        <main className="content">{renderPage()}</main>
      </div>
      <SearchOverlay />
      <NotificationPanel />
      <ProfileDropdown />
      <ToastContainer toasts={toasts} />
      <InvestigationModal open={investigationModalOpen} onClose={() => setInvestigationModalOpen(false)} onCreate={createInvestigation} />
      <NewCaseModal open={newCaseModalOpen} onClose={() => setNewCaseModalOpen(false)} onCreate={addCase} />
    </div>
  )
}

export default function App() {
  return <AppProvider><AppContent /></AppProvider>
}
