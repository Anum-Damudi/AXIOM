import { VIEW_META } from '../data/mockData'
import { useApp } from '../context/AppContext'
import Icon from './Icon'

export default function TopBar() {
  const {
    user,
    activeView,
    settings,
    setSidebarOpen,
    setSearchOpen,
    setNotificationsOpen,
    setProfileOpen,
    openStartInvestigation,
    unreadCount,
    updateSettings,
  } = useApp()

  const meta = VIEW_META[activeView] || VIEW_META.dashboard
  const initials = user?.initials || user?.displayName?.split(' ').map((n) => n[0]).join('') || 'U'
  const displayName = user?.displayName || user?.name || 'User'
  const role = user?.roleLabel || user?.role || 'Investigator'

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="topbar__menu-btn"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
        >
          <Icon name="menu" className="icon-sm" />
        </button>
        <div className="topbar__titles">
          <span className="topbar__breadcrumb">{meta.breadcrumb}</span>
          <h1 className="topbar__title">{meta.title}</h1>
        </div>
      </div>
      <div className="topbar__actions">
        <button
          type="button"
          className="topbar__icon-btn topbar__icon-btn--accent"
          aria-label="Start Investigation"
          onClick={openStartInvestigation}
          title="Start Investigation"
        >
          <Icon name="plus" className="icon-sm" />
        </button>
        <button
          type="button"
          className="topbar__icon-btn"
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
          title="Search (Ctrl+K)"
        >
          <Icon name="search" className="icon-sm" />
        </button>
        <button
          type="button"
          className="topbar__icon-btn"
          aria-label="Notifications"
          onClick={() => setNotificationsOpen(true)}
          title="Notifications"
        >
          <Icon name="bell" className="icon-sm" />
          {unreadCount > 0 && <span className="topbar__notif-dot" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="topbar__icon-btn"
          aria-label="Toggle theme"
          onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          title={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <Icon name={settings.theme === 'dark' ? 'grid' : 'network'} className="icon-sm" />
        </button>
        <button
          type="button"
          className="topbar__profile"
          onClick={() => setProfileOpen(true)}
          aria-label="Open profile menu"
        >
          <div className="topbar__profile-avatar">{initials}</div>
          <div className="topbar__profile-text">
            <span>{displayName}</span>
            <span className="topbar__profile-role">{role}</span>
          </div>
        </button>
      </div>
    </header>
  )
}
