const RELATIONSHIP_TYPES = [
  'ASSOCIATED_WITH', 'USES', 'LOCATED_AT', 'OWNS', 'LINKED_TO',
  'COMMUNICATES_WITH', 'TRANSACTED_WITH', 'WORKS_AT', 'VISITED', 'CONNECTED_TO',
]

const RELATIONSHIP_LABELS = {
  ASSOCIATED_WITH: 'Associated With', USES: 'Uses', LOCATED_AT: 'Located At',
  OWNS: 'Owns', LINKED_TO: 'Linked To', COMMUNICATES_WITH: 'Communicates With',
  TRANSACTED_WITH: 'Transacted With', WORKS_AT: 'Works At', VISITED: 'Visited',
  CONNECTED_TO: 'Connected To',
}

const TYPE_COMPATIBILITY = {
  PERSON: ['PERSON', 'ORGANIZATION', 'PHONE', 'VEHICLE', 'LOCATION', 'BANK', 'CONTACT'],
  ORGANIZATION: ['PERSON', 'LOCATION', 'BANK', 'PHONE'],
  PHONE: ['PERSON', 'ORGANIZATION'],
  VEHICLE: ['PERSON', 'LOCATION'],
  LOCATION: ['PERSON', 'ORGANIZATION', 'VEHICLE'],
  BANK: ['PERSON', 'ORGANIZATION'],
  CONTACT: ['PERSON'],
  DIGITAL_IDENTIFIER: ['PERSON', 'ORGANIZATION', 'PHONE'],
}

function computeEntityHash(entity) {
  let hash = 0
  const str = `${entity.name}${entity.type}${entity.description || ''}`
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function suggestRelationshipType(entityA, entityB) {
  const typeA = (entityA.type || '').toUpperCase()
  const typeB = (entityB.type || '').toUpperCase()

  if (typeA === 'PERSON' && typeB === 'PHONE') return 'USES'
  if (typeA === 'PERSON' && typeB === 'VEHICLE') return 'OWNS'
  if (typeA === 'PERSON' && typeB === 'LOCATION') return 'VISITED'
  if (typeA === 'PERSON' && typeB === 'BANK') return 'TRANSACTED_WITH'
  if (typeA === 'PERSON' && typeB === 'ORGANIZATION') return 'ASSOCIATED_WITH'
  if (typeA === 'ORGANIZATION' && typeB === 'LOCATION') return 'LOCATED_AT'
  if (typeA === 'ORGANIZATION' && typeB === 'BANK') return 'TRANSACTED_WITH'
  if (typeA === 'PERSON' && typeB === 'CONTACT') return 'USES'
  if (typeA === 'ORGANIZATION' && typeB === 'PERSON') return 'WORKS_AT'
  if (typeA === 'PERSON' && typeB === 'DIGITAL_IDENTIFIER') return 'LINKED_TO'
  return 'ASSOCIATED_WITH'
}

function generateReason(entityA, entityB, relType, intelligence) {
  const descA = (entityA.description || '').toLowerCase()
  const descB = (entityB.description || '').toLowerCase()

  const sharedKeywords = []
  const keywords = ['financial', 'transaction', 'communication', 'phone', 'location', 'office',
    'transfer', 'payment', 'account', 'meeting', 'transport', 'storage', 'digital', 'encrypted']

  keywords.forEach(kw => {
    if (descA.includes(kw) && descB.includes(kw)) sharedKeywords.push(kw)
  })

  const matchingIntel = intelligence.filter(intel => {
    const text = (intel.description || intel.text || '').toLowerCase()
    return text.includes(entityA.name?.toLowerCase()) && text.includes(entityB.name?.toLowerCase())
  })

  if (matchingIntel.length > 0) {
    return `Intelligence report links these entities: "${matchingIntel[0].description || matchingIntel[0].text}".`
  }

  if (sharedKeywords.length > 0) {
    return `Both entities share keywords (${sharedKeywords.join(', ')}) in their descriptions.`
  }

  const typeLabelA = entityA.type || 'entity'
  const typeLabelB = entityB.type || 'entity'
  const relLabel = RELATIONSHIP_LABELS[relType] || relType.toLowerCase().replace(/_/g, ' ')

  return `Pattern analysis suggests a possible ${relLabel} relationship between this ${typeLabelA.toLowerCase()} and ${typeLabelB.toLowerCase()}.`
}

export function analyzeCase(entities, intelligence = [], locations = []) {
  if (!entities || entities.length < 2) return []

  const suggestions = []
  const existingPairs = new Set()

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i]
      const b = entities[j]
      const typeA = (a.type || '').toUpperCase()
      const typeB = (b.type || '').toUpperCase()

      const compatible = TYPE_COMPATIBILITY[typeA]?.includes(typeB) || TYPE_COMPATIBILITY[typeB]?.includes(typeA)
      if (!compatible) continue

      const pairKey = [a.id, b.id].sort().join('::')
      if (existingPairs.has(pairKey)) continue
      existingPairs.add(pairKey)

      const hashA = computeEntityHash(a)
      const hashB = computeEntityHash(b)
      const combinedHash = (hashA ^ hashB) >>> 0

      const descA = (a.description || '').toLowerCase()
      const descB = (b.description || '').toLowerCase()

      const matchingIntel = intelligence.filter(intel => {
        const text = (intel.description || intel.text || '').toLowerCase()
        return text.includes(a.name?.toLowerCase()) && text.includes(b.name?.toLowerCase())
      })

      const descOverlap = keywords => keywords.filter(kw => descA.includes(kw) && descB.includes(kw)).length

      const financialKw = ['financial', 'transaction', 'payment', 'transfer', 'account', 'money', 'fund', 'bank']
      const commKw = ['communication', 'phone', 'call', 'message', 'contact', 'encrypted']
      const locationKw = ['location', 'office', 'warehouse', 'area', 'district', 'city']
      const orgKw = ['organization', 'company', 'business', 'firm', 'agency']

      let relevanceScore = 0.3 + (combinedHash % 20) / 100

      if (matchingIntel.length > 0) relevanceScore += 0.25
      if (descOverlap(financialKw) >= 2) relevanceScore += 0.15
      if (descOverlap(commKw) >= 2) relevanceScore += 0.12
      if (descOverlap(locationKw) >= 1) relevanceScore += 0.08
      if (descOverlap(orgKw) >= 1) relevanceScore += 0.06

      if (typeA === 'PERSON' && typeB === 'ORGANIZATION') relevanceScore += 0.05
      if (typeA === 'PERSON' && typeB === 'PHONE') relevanceScore += 0.08
      if (typeA === 'ORGANIZATION' && typeB === 'BANK') relevanceScore += 0.10

      if (locations.length > 0) {
        const locsA = locations.filter(l => l.entityId === a.id)
        const locsB = locations.filter(l => l.entityId === b.id)
        if (locsA.length > 0 && locsB.length > 0) {
          const sharedArea = locsA.some(la =>
            locsB.some(lb => {
              const dist = Math.sqrt(Math.pow(la.latitude - lb.latitude, 2) + Math.pow(la.longitude - lb.longitude, 2))
              return dist < 0.05
            })
          )
          if (sharedArea) relevanceScore += 0.12
        }
      }

      const confidence = Math.min(0.95, Math.max(0.45, relevanceScore))
      const confidencePercent = Math.round(confidence * 100)

      if (confidencePercent < 45) continue

      const relType = suggestRelationshipType(a, b)
      const reason = generateReason(a, b, relType, matchingIntel)

      suggestions.push({
        id: `AISUG-${Date.now()}-${combinedHash.toString(36)}`,
        caseId: a.caseId,
        fromId: a.id,
        toId: b.id,
        fromName: a.name,
        toName: b.name,
        fromType: a.type,
        toType: b.type,
        type: relType,
        confidence: confidencePercent,
        reason,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      })
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence)

  return suggestions.slice(0, Math.min(suggestions.length, Math.max(5, Math.floor(entities.length * 1.5))))
}

export function simulateAnalysisProgress(onStep) {
  const steps = [
    { message: 'Initializing AI analysis engine...', delay: 400 },
    { message: 'Identifying entities in case...', delay: 500 },
    { message: 'Analyzing entity descriptions...', delay: 600 },
    { message: 'Comparing entity metadata...', delay: 500 },
    { message: 'Scanning intelligence reports...', delay: 700 },
    { message: 'Detecting potential relationships...', delay: 600 },
    { message: 'Computing confidence scores...', delay: 400 },
    { message: 'Building network suggestions...', delay: 500 },
    { message: 'Analysis complete.', delay: 300 },
  ]

  let totalDelay = 0
  steps.forEach((step) => {
    setTimeout(() => onStep(step.message), totalDelay)
    totalDelay += step.delay
  })

  return new Promise(resolve => setTimeout(resolve, totalDelay))
}

export { RELATIONSHIP_LABELS, RELATIONSHIP_TYPES }
