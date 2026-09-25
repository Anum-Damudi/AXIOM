import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import Icon from './Icon'
import MetricGrid from './ui/MetricGrid'

export default function PhoneProfile({ phoneNumber }) {
  const { getPhoneProfile } = useApp()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (phoneNumber) {
      getPhoneProfile(phoneNumber).then(setProfile)
    }
  }, [phoneNumber, getPhoneProfile])

  return (
    <div className="phone-profile">
      <div className="phone-profile__header">
        <Icon name="phone" className="icon-lg" />
        <h3>{phoneNumber}</h3>
      </div>
      <div className="phone-profile__content">
        {profile ? (
          <MetricGrid
            minWidth="8rem"
            ariaLabel="Phone profile metrics"
            items={[
              { id: 'calls', label: 'Total Calls', value: profile.total_calls || 0, icon: 'phone' },
              { id: 'people', label: 'Associated People', value: profile.associated_people?.length || 0, icon: 'users' },
            ]}
          />
        ) : (
          <p>Loading profile...</p>
        )}
      </div>
    </div>
  )
}
