// Singleton Google Maps JavaScript API dynamic script loader for AXIOM

const GOOGLE_MAPS_KEY_STORAGE = 'nexus_google_maps_api_key'

let loadPromise = null
let hasAuthError = false
const authErrorListeners = new Set()

export function getStoredGoogleMapsApiKey() {
  try {
    const directKey = localStorage.getItem(GOOGLE_MAPS_KEY_STORAGE)
    if (directKey && directKey.trim()) return directKey.trim()

    const settingsRaw = localStorage.getItem('nexus_settings')
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw)
      if (parsed?.googleMapsApiKey && parsed.googleMapsApiKey.trim()) {
        return parsed.googleMapsApiKey.trim()
      }
    }
  } catch (e) {
    console.warn('Error reading stored Google Maps API key:', e)
  }

  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  return (envKey && envKey.trim()) || ''
}

export function saveGoogleMapsApiKey(key) {
  const cleanKey = (key || '').trim()
  try {
    if (cleanKey) {
      localStorage.setItem(GOOGLE_MAPS_KEY_STORAGE, cleanKey)
    } else {
      localStorage.removeItem(GOOGLE_MAPS_KEY_STORAGE)
    }

    // Also sync to nexus_settings for completeness
    const settingsRaw = localStorage.getItem('nexus_settings')
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {}
    settings.googleMapsApiKey = cleanKey
    localStorage.setItem('nexus_settings', JSON.stringify(settings))
  } catch (e) {
    console.warn('Error saving Google Maps API key:', e)
  }

  // Reset cached loader so subsequent calls attempt load with new key
  resetGoogleMapsLoader()
}

export function resetGoogleMapsLoader() {
  loadPromise = null
  hasAuthError = false
  const existingScript = document.getElementById('google-maps-api-script')
  if (existingScript) {
    existingScript.remove()
  }
}

export function onGoogleMapsAuthError(callback) {
  authErrorListeners.add(callback)
  if (hasAuthError) callback()
  return () => authErrorListeners.delete(callback)
}

function notifyAuthError() {
  hasAuthError = true
  authErrorListeners.forEach(cb => {
    try { cb() } catch (err) { console.error(err) }
  })
}

export function isGoogleMapsLoaded() {
  return typeof window !== 'undefined' && !!window.google?.maps
}

export function loadGoogleMaps(apiKeyOverride) {
  if (isGoogleMapsLoaded()) {
    return Promise.resolve(window.google.maps)
  }

  if (loadPromise) {
    return loadPromise
  }

  const apiKey = (apiKeyOverride || getStoredGoogleMapsApiKey()).trim()

  if (!apiKey) {
    return Promise.reject(new Error('NO_API_KEY'))
  }

  // Intercept Google Maps Authentication Failures
  window.gm_authFailure = () => {
    console.warn('[AXIOM] Google Maps API Authentication Failure reported by Google.')
    notifyAuthError()
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check if script already attached
    let script = document.getElementById('google-maps-api-script')
    if (!script) {
      script = document.createElement('script')
      script.id = 'google-maps-api-script'
      script.async = true
      script.defer = true
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,visualization,geometry&loading=async&v=weekly`

      script.onload = () => {
        if (window.google?.maps) {
          resolve(window.google.maps)
        } else {
          reject(new Error('Google Maps script loaded but window.google.maps is undefined'))
        }
      }

      script.onerror = () => {
        loadPromise = null
        notifyAuthError()
        reject(new Error('Failed to load Google Maps script from Google servers'))
      }

      document.head.appendChild(script)
    } else {
      // Script was already in DOM
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval)
          resolve(window.google.maps)
        }
      }, 50)
      setTimeout(() => {
        clearInterval(checkInterval)
        if (window.google?.maps) resolve(window.google.maps)
        else reject(new Error('Timeout waiting for Google Maps script'))
      }, 10000)
    }
  })

  return loadPromise
}
