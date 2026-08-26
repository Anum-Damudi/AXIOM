import Icon from './Icon'

export default function Drawer({ open, onClose, title, children, width = '480px' }) {
  return (
    <>
      <div
        className={`drawer-backdrop ${open ? 'drawer-backdrop--open' : ''}`}
        onClick={onClose}
        role="presentation"
      />
      <aside
        className={`drawer ${open ? 'drawer--open' : ''}`}
        style={{ '--drawer-width': width }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <header className="drawer__header">
          <h2 className="drawer__title">{title}</h2>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            <Icon name="close" className="icon-sm" />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </aside>
    </>
  )
}
