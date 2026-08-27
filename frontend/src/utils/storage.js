const INVESTIGATIONS_KEY = 'nexus_investigations'
const SETTINGS_KEY = 'nexus_settings'
const SESSION_KEY = 'nexus_session'
const ACTIVITY_KEY = 'nexus_activity'
const ACCESS_REQUESTS_KEY = 'nexus_access_requests'
const USERS_STATE_KEY = 'nexus_users_state'
const CASES_KEY = 'nexus_cases'
const ENTITIES_KEY = 'nexus_entities'
const RELATIONSHIPS_KEY = 'nexus_relationships'

export function loadInvestigations() {
  try {
    const raw = localStorage.getItem(INVESTIGATIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveInvestigations(investigations) {
  localStorage.setItem(INVESTIGATIONS_KEY, JSON.stringify(investigations))
}

export function loadSettings(userId) {
  const key = userId ? `${SETTINGS_KEY}_${userId}` : SETTINGS_KEY
  try {
    const raw = localStorage.getItem(key)
    return raw
      ? JSON.parse(raw)
      : {
          theme: 'dark',
          autoAnalyze: true,
          riskThreshold: 'medium',
          investigationAlerts: true,
          criticalRiskAlerts: true,
          caseUpdates: true,
          emailAlerts: true,
          pushAlerts: true,
          compactMode: false,
          reduceAnimations: false,
        }
  } catch {
    return {
      theme: 'dark', autoAnalyze: true, riskThreshold: 'medium',
      investigationAlerts: true, criticalRiskAlerts: true, caseUpdates: true,
      emailAlerts: true, pushAlerts: true, compactMode: false, reduceAnimations: false,
    }
  }
}

export function saveSettings(settings, userId) {
  const key = userId ? `${SETTINGS_KEY}_${userId}` : SETTINGS_KEY
  localStorage.setItem(key, JSON.stringify(settings))
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

export function loadActivityLog(userId) {
  try {
    const raw = localStorage.getItem(`${ACTIVITY_KEY}_${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function appendActivity(userId, entry) {
  const log = loadActivityLog(userId)
  const item = { id: `act-${Date.now()}`, timestamp: new Date().toISOString(), ...entry }
  const updated = [item, ...log].slice(0, 100)
  localStorage.setItem(`${ACTIVITY_KEY}_${userId}`, JSON.stringify(updated))
  return updated
}

export function loadAccessRequests() {
  try {
    const raw = localStorage.getItem(ACCESS_REQUESTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveAccessRequest(request) {
  const list = loadAccessRequests()
  list.unshift(request)
  localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(list))
  return list
}

export function loadUsersState(defaultUsers) {
  try {
    const raw = localStorage.getItem(USERS_STATE_KEY)
    return raw ? JSON.parse(raw) : defaultUsers
  } catch {
    return defaultUsers
  }
}

export function saveUsersState(users) {
  localStorage.setItem(USERS_STATE_KEY, JSON.stringify(users))
}

export function loadCases() {
  try {
    const raw = localStorage.getItem(CASES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveCases(cases) {
  localStorage.setItem(CASES_KEY, JSON.stringify(cases))
}

export function loadEntities() {
  try {
    const raw = localStorage.getItem(ENTITIES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveEntities(entities) {
  localStorage.setItem(ENTITIES_KEY, JSON.stringify(entities))
}

export function loadRelationships() {
  try {
    const raw = localStorage.getItem(RELATIONSHIPS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveRelationships(relationships) {
  localStorage.setItem(RELATIONSHIPS_KEY, JSON.stringify(relationships))
}

const INTELLIGENCE_KEY = 'nexus_intelligence'
const AI_SUGGESTIONS_KEY = 'nexus_ai_suggestions'
const TIMELINE_KEY = 'nexus_timeline'

export function loadIntelligence() {
  try {
    const raw = localStorage.getItem(INTELLIGENCE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveIntelligence(intelligence) {
  localStorage.setItem(INTELLIGENCE_KEY, JSON.stringify(intelligence))
}

export function loadAISuggestions() {
  try {
    const raw = localStorage.getItem(AI_SUGGESTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveAISuggestions(suggestions) {
  localStorage.setItem(AI_SUGGESTIONS_KEY, JSON.stringify(suggestions))
}

export function loadTimeline() {
  try {
    const raw = localStorage.getItem(TIMELINE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveTimeline(timeline) {
  localStorage.setItem(TIMELINE_KEY, JSON.stringify(timeline))
}

const LOCATIONS_KEY = 'nexus_locations'
const EVIDENCE_KEY = 'nexus_evidence'

export function loadLocations() {
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveLocations(locations) {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations))
}

export function loadEvidence() {
  try {
    const raw = localStorage.getItem(EVIDENCE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveEvidence(evidence) {
  localStorage.setItem(EVIDENCE_KEY, JSON.stringify(evidence))
}
