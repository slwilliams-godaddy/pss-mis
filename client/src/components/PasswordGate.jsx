import { useState } from 'react'
import { checkPassword } from '../utils/storage'

export default function PasswordGate({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (checkPassword(password)) {
      onSuccess()
    } else {
      setError('Incorrect password.')
    }
  }

  return (
    <div className="password-gate">
      <div className="password-card">
        <h2>Supervisor Access</h2>
        <p>Enter the supervisor password to continue.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Password"
            autoFocus
            required
          />
          {error && <p className="gate-error">{error}</p>}
          <button type="submit" className="btn-primary">Continue</button>
        </form>
      </div>
    </div>
  )
}
