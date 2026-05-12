import { useState } from 'react'
import { checkUser, getSupervisorUsernames } from '../utils/storage'

export default function PasswordGate({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const usernames = getSupervisorUsernames()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (checkUser(username, password)) {
      onSuccess(username)
    } else {
      setError('Incorrect username or password.')
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
          />
          {error && <p className="gate-error">{error}</p>}
          <button type="submit" className="btn-primary">Continue</button>
        </form>
      </div>
    </div>
  )
}
