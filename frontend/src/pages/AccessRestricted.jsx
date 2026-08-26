import Icon from '../components/Icon'

export default function AccessRestricted({ onBack }) {
  return (
    <div className="access-restricted">
      <div className="access-restricted__icon">
        <Icon name="shield" className="icon-lg" />
      </div>
      <h2 className="access-restricted__title">Access Restricted</h2>
      <p className="access-restricted__desc">
        You do not have permission to access this section. This area requires a higher privilege level.
      </p>
      <p className="access-restricted__hint">
        Contact your system administrator to request access.
      </p>
      <button type="button" className="btn btn--primary" onClick={onBack}>
        Back to Dashboard
      </button>
    </div>
  )
}
