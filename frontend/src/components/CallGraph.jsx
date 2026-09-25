import Icon from './Icon'

export default function CallGraph({ phoneNumber }) {
  return (
    <div className="call-graph">
      <div className="call-graph__header">
        <h3>Call Network Graph</h3>
        <Icon name="network" className="icon-sm" />
      </div>
      <div className="call-graph__content">
        <div className="empty-state">
          <Icon name="network" className="icon-xl" />
          <p>Call network visualization for {phoneNumber}</p>
        </div>
      </div>
    </div>
  )
}
