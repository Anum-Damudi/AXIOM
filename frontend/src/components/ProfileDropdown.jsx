import { useApp } from '../context/AppContext'
import Icon from './Icon'

export default function ProfileDropdown() {
  const { user, profileOpen, setProfileOpen, navigate, logout } = useApp()

  if (!profileOpen) return null

  const initials = user?.initials || user?.displayName?.split(' ').map((n) => n[0]).join('') || 'U'
  const displayName = user?.displayName || user?.name || 'User'
  const role = user?.roleLabel || user?.role || 'Investigator'
  const department = user?.department || 'Criminal Intelligence Unit'
  const shift = user?.shift || 'On Duty'

  return (
    <>
      <div className="panel-backdrop" onClick={() => setProfileOpen(false)} role="presentation" />
      <div className="profile-dropdown">
        <div className="profile-dropdown__header">
          <div className="profile-dropdown__avatar">{initials}</div>
          <div>
            <span className="profile-dropdown__name">{displayName}</span>
            <span className="profile-dropdown__role">{role}</span>
          </div>
        </div>
        <div className="profile-dropdown__status">
          <span className="profile-dropdown__status-dot" />
          {shift}
        </div>
        <div className="profile-dropdown__info">
          <span className="profile-dropdown__info-label">Department</span>
          <span className="profile-dropdown__info-value">{department}</span>
          {user?.employeeId && (
            <>
              <span className="profile-dropdown__info-label">Employee ID</span>
              <span className="profile-dropdown__info-value">{user.employeeId}</span>
            </>
          )}
        </div>
        <div className="profile-dropdown__actions">
          <button
            type="button"
            className="profile-dropdown__item"
            onClick={() => {
              setProfileOpen(false)
              navigate('settings')
            }}
          >
            <Icon name="settings" className="icon-sm" />
            Settings
          </button>
          <button
            type="button"
            className="profile-dropdown__item profile-dropdown__item--danger"
            onClick={() => {
              setProfileOpen(false)
              logout()
            }}
          >
            <Icon name="logout" className="icon-sm" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}
