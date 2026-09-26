import Icon from './Icon'

const TOAST_ICON = {
  success: 'check',
  info: 'network',
  warning: 'alert',
  error: 'alert',
}

export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => {
        const type = TOAST_ICON[toast.type] ? toast.type : 'info'
        return (
          <div
            key={toast.id}
            className={`toast toast--${type}`}
            role={type === 'error' ? 'alert' : 'status'}
          >
            <Icon name={TOAST_ICON[type]} className="icon-sm" />
            <span>{toast.message}</span>
          </div>
        )
      })}
    </div>
  )
}
