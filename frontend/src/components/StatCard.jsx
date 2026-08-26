import Icon from './Icon'

export default function StatCard({ stat, onClick }) {
  return (
    <button type="button" className="stat-card stat-card--clickable" onClick={onClick}>
      <div className="stat-card__icon">
        <Icon name={stat.icon} className="icon-sm" />
      </div>
      <div className="stat-card__body">
        <span className="stat-card__value">{stat.value}</span>
        <span className="stat-card__label">{stat.label}</span>
        <span className="stat-card__change">{stat.change}</span>
      </div>
    </button>
  )
}
