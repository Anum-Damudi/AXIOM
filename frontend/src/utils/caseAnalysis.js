export function normalizeEntityValue(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function getEntityDisplayName(entity) {
  if (!entity) return ''
  return entity.name || entity.label || entity.title || entity.plate_number || entity.plateNumber || entity.value || ''
}

export function classifyEntityType(entity) {
  if (!entity) return 'Other'

  const rawType = String(entity.type || entity.entityType || '').toLowerCase()
  if (['person', 'suspect', 'witness', 'victim', 'offender', 'individual'].includes(rawType)) return 'Person'
  if (['vehicle', 'car', 'truck', 'motorcycle', 'bus', 'van', 'boat', 'bike', 'automobile'].includes(rawType)) return 'Vehicle'
  if (['location', 'place', 'venue', 'address', 'city', 'district', 'region', 'site', 'geolocation'].includes(rawType)) return 'Location'

  const displayName = getEntityDisplayName(entity)
  if (/^[A-Z]{2,4}-\d{2}-[A-Z0-9-]+$/.test(displayName.trim())) return 'Vehicle'
  return 'Other'
}

export function buildCaseAnalysisSuggestions(currentCaseId, allCases, allEntities, deniedCaseConnections = []) {
  const sourceEntities = allEntities.filter(entity => entity.caseId === currentCaseId)
  if (!sourceEntities.length) return []

  const suggestions = []

  for (const otherCase of allCases.filter(caseItem => caseItem.id !== currentCaseId)) {
    const otherEntities = allEntities.filter(entity => entity.caseId === otherCase.id)
    const groupedMatches = {
      Person: new Set(),
      Vehicle: new Set(),
      Location: new Set(),
      Other: new Set(),
    }
    const seen = new Set()

    for (const sourceEntity of sourceEntities) {
      const sourceType = classifyEntityType(sourceEntity)
      const sourceName = getEntityDisplayName(sourceEntity)
      const sourceKey = normalizeEntityValue(sourceName)
      if (!sourceKey) continue

      for (const targetEntity of otherEntities) {
        const targetType = classifyEntityType(targetEntity)
        if (targetType !== sourceType) continue

        const targetName = getEntityDisplayName(targetEntity)
        const targetKey = normalizeEntityValue(targetName)
        if (!targetKey || sourceKey !== targetKey) continue

        const groupKey = `${sourceType}:${sourceKey}`
        if (!seen.has(groupKey)) {
          groupedMatches[sourceType].add(sourceKey)
          seen.add(groupKey)
        }
      }
    }

    const sharedEntities = Object.entries(groupedMatches)
      .filter(([, values]) => values.size > 0)
      .map(([type, values]) => ({
        type,
        values: [...values].map(value => value.trim()).filter(Boolean),
      }))

    if (!sharedEntities.length) continue

    const primaryType = sharedEntities[0].type === 'Other' ? 'entity' : sharedEntities[0].type.toLowerCase()
    const deniedKey = `${currentCaseId}:${otherCase.id}:${primaryType === 'entity' ? 'shared_entity' : `shared_${primaryType}`}`
    const isDenied = deniedCaseConnections.some(item => {
      const key = `${item.caseId}:${item.targetCaseId}:${item.connectionType}`
      return key === deniedKey || (item.caseId === currentCaseId && item.targetCaseId === otherCase.id)
    })
    if (isDenied) continue

    const connectionType = sharedEntities.length === 1
      ? (primaryType === 'entity' ? 'shared_entity' : `shared_${primaryType}`)
      : 'shared_entity'

    const commonInfo = sharedEntities
      .map(group => `${group.type}: ${group.values.join('; ')}`)
      .join(' | ')

    suggestions.push({
      id: `CASE_CONN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${otherCase.id}`,
      caseId: currentCaseId,
      targetCaseId: otherCase.id,
      targetCaseTitle: otherCase.title || otherCase.id,
      connectionType,
      commonInfo,
      confidence: Math.min(98, 82 + sharedEntities.reduce((total, group) => total + group.values.length, 0) * 5),
      reason: `Shared entity match detected: ${commonInfo}`,
      sharedEntities,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    })
  }

  return suggestions
}
