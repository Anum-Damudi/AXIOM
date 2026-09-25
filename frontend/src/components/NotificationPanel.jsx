import { useApp } from '../context/AppContext'
import Icon from './Icon'

// Notifications are stored as flat lines; derive a display kind from the real
// message text so each row reads as structured metadata, not a run-on log line.
function kindFor(message = '') {
  const text = message.toLowerCase()
  if (text.includes('risk') || text.includes('critical')) return { label: 'Risk Alert', icon: 'alert' }
  if (text.includes('connection') || text.includes('discovered') || text.includes('network')) return { label: 'Network', icon: 'network' }
  if (text.includes('confidence') || text.includes('evidence')) return { label: 'Evidence', icon: 'shield' }
  if (text.includes('suspect') || text.includes('person')) return { label: 'Subject', icon: 'users' }
  return { label: 'Intelligence', icon: 'ai' }
}

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
          {notifications.map((n) => {
            const kind = kindFor(n.message)
            return (
              <article key={n.id} className={`notif-item ${n.read ? '' : 'notif-item--unread'}`}>
                <div className="notif-item__icon" aria-hidden="true">
                  <Icon name={kind.icon} className="icon-xs" />
                </div>
                <div className="notif-item__content">
                  <span className="notif-item__kind">
                    {!n.read && <span className="notif-item__dot" />}
                    {kind.label}
                  </span>
                  <dl className="notif-item__details">
                    <div>
                      <dt>Update</dt>
                      <dd className="notif-item__message">{n.message}</dd>
                    </div>
                    <div>
                      <dt>Received</dt>
                      <dd className="notif-item__time">{n.time}</dd>
                    </div>
                  </dl>
                </div>
                <button
                  type="button"
                  className="notif-item__dismiss"
                  onClick={() => dismissNotification(n.id)}
                  aria-label={`Dismiss ${kind.label.toLowerCase()} notification`}
                >
                  <Icon name="close" className="icon-xs" />
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </>
  )
}
