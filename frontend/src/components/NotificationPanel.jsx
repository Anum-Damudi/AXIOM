import { useApp } from '../context/AppContext'
import Icon from './Icon'

export default function NotificationPanel() {
  const { notificationsOpen, setNotificationsOpen, notifications, dismissNotification, markNotificationsRead } = useApp()

  if (!notificationsOpen) return null

  return (
    <>
      <div className="panel-backdrop" onClick={() => setNotificationsOpen(false)} role="presentation" />
      <div className="notif-panel">
        <header className="notif-panel__header">
          <h3>Intelligence Alerts</h3>
          <button type="button" className="btn btn--ghost btn--sm" onClick={markNotificationsRead}>
            Mark all read
          </button>
        </header>
        <div className="notif-panel__list">
          {notifications.length === 0 && (
            <p className="notif-panel__empty">No notifications</p>
          )}
          {notifications.map((n) => (
            <div key={n.id} className={`notif-item ${n.read ? '' : 'notif-item--unread'}`}>
              <div className="notif-item__content">
                {!n.read && <span className="notif-item__dot" />}
                <p>{n.message}</p>
                <span className="notif-item__time">{n.time}</span>
              </div>
              <button
                type="button"
                className="notif-item__dismiss"
                onClick={() => dismissNotification(n.id)}
                aria-label="Dismiss"
              >
                <Icon name="close" className="icon-xs" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
