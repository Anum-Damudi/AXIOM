import Icon from './Icon'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal modal--${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal__header">
          <h2 id="modal-title" className="modal__title">{title}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <Icon name="close" className="icon-sm" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  )
}
