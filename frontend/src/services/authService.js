/**
 * Authentication service — prototype mock implementation.
 * Replace with real API calls (POST /api/auth/login, etc.) in production.
 * Frontend-only auth is NOT secure and must not be used in production.
 */

import { DEMO_USERS, sanitizeUser } from '../data/users'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function mockLogin(email, password) {
  await delay(500)
  const user = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase().trim())
  if (!user || user.password !== password) {
    throw new Error('Invalid official email or password.')
  }
  return {
    user: sanitizeUser({ ...user, lastLogin: new Date().toISOString() }),
    token: `mock-token-${user.id}-${Date.now()}`,
  }
}

export async function mockForgotPassword(email) {
  await delay(600)
  const exists = DEMO_USERS.some((u) => u.email.toLowerCase() === email.toLowerCase().trim())
  if (!exists) {
    throw new Error('No account found for this email address.')
  }
  return { success: true }
}

export async function mockAccessRequest(data) {
  await delay(700)
  return { id: `REQ-${Date.now()}`, ...data, status: 'Pending', submittedAt: new Date().toISOString() }
}

export async function mockChangePassword(currentPassword, newPassword) {
  await delay(400)
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }
  return { success: true }
}
