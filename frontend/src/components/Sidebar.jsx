import { useApp } from '../context/AppContext'
import Icon from './Icon'
import NexusCrimeLogo from './NexusCrimeLogo'

export default function Sidebar() {
  const { user, activeView, sidebarOpen, sidebarCollapsed, setSidebarOpen, setSidebarCollapsed, navigate, navItems, cases } = useApp()

  const initials = user?.initials || user?.displayName?.split(' ').map((n) => n[0]).join('') || 'U'
  const displayName = user?.displayName || user?.name || 'User'
  const role = user?.roleLabel || user?.role || 'Investigator'
  const activeCases = cases.filter((c) => c.status === 'Active').length

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''} ${sidebarCollapsed ? 'sidebar--collapsed' : ''}`}>
        <div className="sidebar__brand">
          <NexusCrimeLogo size={36} className="sidebar__logo-component" />
          {!sidebarCollapsed && (
            <div className="sidebar__brand-text">
              <span className="sidebar__brand-name">NEXUS</span>
              <span className="sidebar__brand-tag">CRIME INTELLIGENCE</span>
            </div>
          )}
          <button
            type="button"
            className="sidebar__close"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="close" className="icon-sm" />
          </button>
        </div>

        <nav className="sidebar__nav">
          <span className="sidebar__nav-label">{sidebarCollapsed ? '' : 'Main Navigation'}</span>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar__link ${activeView === item.id ? 'sidebar__link--active' : ''}`}
              onClick={() => navigate(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon name={item.icon} className="icon-sm" />
              {!sidebarCollapsed && (
                <>
                  {item.label}
                  {item.id === 'cases' && activeCases > 0 && (
                    <span className="sidebar__badge">{activeCases}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          {!sidebarCollapsed && (
            <div className="system-status">
              <span className="system-status__dot" aria-hidden="true" />
              <span>System Online</span>
            </div>
          )}
          <button
            type="button"
            className="investigator-profile investigator-profile--btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div className="investigator-profile__avatar">{initials}</div>
            {!sidebarCollapsed && (
              <div className="investigator-profile__info">
                <span className="investigator-profile__name">{displayName}</span>
                <span className="investigator-profile__role">{role}</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
