export default function RiskBadge({ level }) {
  const cls = (level || 'LOW').toLowerCase()
  return <span className={`risk-badge risk-badge--${cls}`}>{level}</span>
}
