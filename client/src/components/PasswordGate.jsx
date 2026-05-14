import { useState, useEffect } from 'react'
import { checkUser, getSupervisorUsernames } from '../utils/storage'

export default function PasswordGate({ onSuccess }) {
  const [usernames, setUsernames] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getSupervisorUsernames().then(names => {
      setUsernames(names)
      if (names.length === 1) setUsername(names[0])
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const ok = await checkUser(username, password)
      if (ok) {
        onSuccess(username)
      } else {
        setError('Incorrect username or password.')
      }
    } catch {
      setError('Could not verify credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="password-gate">
      <div className="password-card">
        <h2>Supervisor Access</h2>
        <form onSubmit={handleSubmit}>
          <select
            value={username}
            onChange={e => { setUsername(e.target.value); setError('') }}
            required
            autoFocus
            disabled={loading}
          >
            <option value="" disabled>Select user</option>
            {usernames.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Password"
            required
            disabled={loading}
          />
          {error && <p className="gate-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading || !username}>
            {loading ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
