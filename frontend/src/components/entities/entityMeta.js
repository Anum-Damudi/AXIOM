const TYPE_META = {
  PERSON: { icon: 'users', label: 'Person' },
  POI: { icon: 'users', label: 'Person of Interest' },
  PERSON_OF_INTEREST: { icon: 'users', label: 'Person of Interest' },
  SUSPECT: { icon: 'users', label: 'Suspect' },
  VEHICLE: { icon: 'location', label: 'Vehicle' },
  LOCATION: { icon: 'map', label: 'Location' },
  PHONE: { icon: 'phone', label: 'Phone' },
  ORGANIZATION: { icon: 'globe', label: 'Organization' },
  BANK: { icon: 'shield', label: 'Bank' },
  EVIDENCE: { icon: 'file', label: 'Evidence' },
  CASE: { icon: 'folder', label: 'Case' },
  CONTACT: { icon: 'users', label: 'Contact' },
  OTHER: { icon: 'document', label: 'Other' },
}

export function entityTypeKey(type) {
  return String(type || 'OTHER').trim().toUpperCase()
}

export function entityTypeMeta(type) {
  return TYPE_META[entityTypeKey(type)] || { icon: 'document', label: String(type || 'Other') }
}

// Entity types that map to the same icon so modal grouping is stable.
export function entityGroupKey(type) {
  const meta = entityTypeMeta(type)
  if (meta.icon === 'users' || meta.icon === 'phone') return meta.label
  return meta.label
}