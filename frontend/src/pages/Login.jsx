import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import NexusCrimeLogo from '../components/NexusCrimeLogo'

export default function Login() {
  const { login, navigateTo } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => {
    try { return localStorage.getItem('nexus_remember') === 'true' } catch { return false }
  })
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.')
      return
    }
    localStorage.setItem('nexus_remember', String(rememberMe))
    login(email.trim(), email.trim())
  }

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-bg__grid" aria-hidden="true" />
        <div className="login-bg__glow" aria-hidden="true" />
      </div>

      <button
        className="login-back"
        onClick={() => navigateTo('landing')}
        type="button"
      >
        <Icon name="arrow-left" className="icon-xs" />
        Back to NEXUS-CRIME
      </button>

      <div className="login-container">
        <header className="login-header">
            <div className="login-brand">
            <NexusCrimeLogo size={48} className="login-brand__logo-component" />
            <div className="login-brand__text">
              <h1>NEXUS-CRIME</h1>
              <p>Investigation Portal</p>
            </div>
          </div>
          <p className="login-subtitle">Secure access to the intelligence environment</p>
        </header>

        <main className="login-card">
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-form__header">
              <h2>Sign In</h2>
              <p>Enter your credentials to access the platform.</p>
            </div>

            {error && <div className="login-error">{error}</div>}

            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                autoFocus
                autoComplete="email"
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="login-field__password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-field__toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'close' : 'filter'} className="icon-xs" />
                </button>
              </div>
            </label>

            <div className="login-form__row">
              <label className="login-field login-field--inline">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="login-checkbox"
                />
                <span>Remember me</span>
              </label>
            </div>

            <button type="submit" className="login-submit">
              Sign In
            </button>
          </form>
        </main>

        <footer className="login-footer">
          <span>NEXUS-CRIME v1.0 — Criminal Intelligence Platform</span>
          <span>Authorized Personnel Only</span>
        </footer>
      </div>
    </div>
  )
}
