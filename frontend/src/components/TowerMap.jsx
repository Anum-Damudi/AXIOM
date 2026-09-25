import Icon from './Icon'

export default function TowerMap() {
  return (
    <div className="tower-map">
      <div className="tower-map__header">
        <h3>Cell Tower Coverage</h3>
        <Icon name="map" className="icon-sm" />
      </div>
      <div className="tower-map__content">
        <div className="empty-state">
          <Icon name="map" className="icon-xl" />
          <p>Cell tower location map</p>
        </div>
      </div>
    </div>
  )
}
