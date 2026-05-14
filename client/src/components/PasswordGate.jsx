import { useState } from 'react'
import { signIn } from '../utils/storage'

export default function PasswordGate({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await signIn(email.trim(), password)
      onSuccess(session)
    } catch (err) {
      setError(err.message || 'Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="password-gate">
      <div className="password-card">
        <h2>Supervisor Access</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="Email address"
            required
            autoFocus
            autoComplete="email"
            disabled={loading}
          />
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Password"
            required
            autoComplete="current-password"
            disabled={loading}
          />
          {error && <p className="gate-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
