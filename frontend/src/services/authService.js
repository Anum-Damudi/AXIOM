/**
 * Authentication service — talks to the real AXIOM backend.
 * All credentials are verified server-side; nothing is persisted or validated
 * in the browser. Passwords are never stored client-side.
 */

export const API_BASE = '/api/v1'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  let body
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const message =
      body?.message ||
      body?.error ||
      (typeof body?.detail === 'string' ? body.detail : null) ||
      `Request failed with status ${response.status}`
    const code =
      body?.code ||
      (body?.detail && typeof body.detail === 'object' ? body.detail.code : null)
    const err = new Error(message)
    err.status = response.status
    err.code = code
    throw err
  }

  return body
}

export async function login(identifier, password) {
  const resp = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: identifier, password }),
  })
  return {
    token: resp.data.access_token,
    user: resp.data.user,
  }
}

export async function getMe(token) {
  const resp = await request('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return resp.data
}

export async function changePassword(currentPassword, newPassword, token) {
  const resp = await request('/auth/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ old_password: currentPassword, new_password: newPassword }),
  })
  return resp
}