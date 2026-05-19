import { useState, useEffect } from 'react'
import logo from './assets/logo.png'
import GuideView from './components/GuideView'
import ManagerView from './components/ManagerView'
import { getGuideNames, checkGuide, changeGuidePassword, checkUser, changeSupervisorPassword, getSupervisorUsernames, checkManager, getManagerUsernames, changeManagerPassword } from './utils/storage'
import { TEAM_DEFS } from './utils/teamConfig'
import './App.css'

function LoginPanel({ onLogin }) {
  const [role, setRole] = useState('')
  const [team, setTeam] = useState('')
  const [name, setName] = useState('')
  const [names, setNames] = useState([])
  const [namesLoading, setNamesLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const needsTeam = role === 'guide'
  const teamReady = !needsTeam || !!team

  useEffect(() => {
    setName('')
    setNames([])
    if (!role || !teamReady) return
    setNamesLoading(true)
    const fetch =
      role === 'guide'  ? getGuideNames(team) :
      role === 'leader' ? Promise.all([
          getSupervisorUsernames(),
          getManagerUsernames(),
        ]).then(([sups, mgrs]) => [...new Set([...sups, ...mgrs])].sort()) :
      Promise.resolve([])
    fetch
      .then(ns => { setNames(ns); if (ns.length === 1) setName(ns[0]); setNamesLoading(false) })
      .catch(() => setNamesLoading(false))
  }, [role, team])

  const handleRoleChange = (r) => { setRole(r); setTeam(''); setName(''); setNames([]); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (role === 'guide') {
        const result = await checkGuide(name, password)
        if (result) { onLogin('guide', { name, team: result.team }) }
        else { setError('Incorrect credentials.') }
      } else {
        const supResult = await checkUser(name, password)
        if (supResult) {
          onLogin('supervisor', { username: name })
        } else {
          const mgrResult = await checkManager(name, password)
          if (mgrResult) { onLogin('manager', mgrResult) }
          else { setError('Incorrect credentials.') }
        }
      }
    } catch {
      setError('Could not verify credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-panel">
      <div>
        <h2 className="login-panel-title">Sign In</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.3rem' }}>Select your role to continue</p>
      </div>
      <form onSubmit={handleSubmit} className="login-panel-form">
        <div className="login-field-group">
          <label className="login-field-label">Role</label>
          <select value={role} onChange={e => handleRoleChange(e.target.value)} required disabled={loading}>
            <option value="" disabled>Select role</option>
            <option value="guide">Guide</option>
            <option value="leader">Leader</option>
          </select>
        </div>

        {role && needsTeam && (
          <div className="login-field-group">
            <label className="login-field-label">Team</label>
            <select value={team} onChange={e => { setTeam(e.target.value); setName(''); setError('') }} required disabled={loading}>
              <option value="" disabled>Select team</option>
              {Object.entries(TEAM_DEFS).map(([id, def]) => (
                <option key={id} value={id}>{def.label}</option>
              ))}
            </select>
          </div>
        )}

        {role && teamReady && (
          <div className="login-field-group">
            <label className="login-field-label">{role === 'guide' ? 'Name' : 'Username'}</label>
            <select value={name} onChange={e => { setName(e.target.value); setError('') }} required disabled={loading || namesLoading}>
              <option value="" disabled>
                {namesLoading ? 'Loading…' : role === 'guide' ? 'Select your name' : 'Select user'}
              </option>
              {names.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        {name && (
          <div className="login-field-group">
            <label className="login-field-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Enter password"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
        )}

        {error && <p className="gate-error">{error}</p>}

        {name && (
          <button type="submit" className="btn-primary login-submit-btn" disabled={loading || !password}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        )}
      </form>
    </div>
  )
}

function GuideSettingsModal({ guideName, onClose }) {
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: 'New passwords do not match.' }); return }
    try {
      await changeGuidePassword(guideName, pwCurrent, pwNew)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setPwMsg({ ok: true, text: 'Password updated.' })
      setTimeout(() => setPwMsg(null), 3000)
    } catch (err) {
      setPwMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Settings</h2>
            <p>Change your password</p>
          </div>
          <button className="btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="password-form">
          <label className="password-field">
            <span>Current password</span>
            <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} required autoComplete="current-password" />
          </label>
          <label className="password-field">
            <span>New password</span>
            <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} required autoComplete="new-password" />
          </label>
          <label className="password-field">
            <span>Confirm new password</span>
            <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} required autoComplete="new-password" />
          </label>
          <div className="password-actions">
            <button type="submit" className="btn-primary">Update Password</button>
            {pwMsg && <span className={pwMsg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>{pwMsg.text}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}

function SupervisorSettingsModal({ currentUser, onClose }) {
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState(null)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: 'New passwords do not match.' }); return }
    try {
      await changeSupervisorPassword(currentUser, pwCurrent, pwNew)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setPwMsg({ ok: true, text: 'Password updated.' })
      setTimeout(() => setPwMsg(null), 3000)
    } catch (err) {
      setPwMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Settings</h2>
            <p>Manage your account</p>
          </div>
          <button className="btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <h4 className="settings-section-label">Change My Password</h4>
        <form onSubmit={handleChangePassword} className="password-form">
          <label className="password-field">
            <span>Current password</span>
            <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} required autoComplete="current-password" />
          </label>
          <label className="password-field">
            <span>New password</span>
            <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} required autoComplete="new-password" />
          </label>
          <label className="password-field">
            <span>Confirm new password</span>
            <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} required autoComplete="new-password" />
          </label>
          <div className="password-actions">
            <button type="submit" className="btn-primary">Update Password</button>
            {pwMsg && <span className={pwMsg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>{pwMsg.text}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}

function ManagerLoginModal({ onSuccess, onClose }) {
  const [usernames, setUsernames] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getManagerUsernames().then(names => {
      setUsernames(names)
      if (names.length === 1) setUsername(names[0])
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await checkManager(username, password)
      if (result) { onSuccess(result) } else { setError('Incorrect username or password.') }
    } catch {
      setError('Could not verify credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Manager Sign In</h2>
            <p>Select your username and enter your password.</p>
          </div>
          <button className="btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <select value={username} onChange={e => { setUsername(e.target.value); setError('') }} required disabled={loading}>
            <option value="" disabled>Select user</option>
            {usernames.map(n => <option key={n} value={n}>{n}</option>)}
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
            {loading ? 'Checking…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ManagerSettingsModal({ currentUser, onClose }) {
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState(null)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: 'New passwords do not match.' }); return }
    try {
      await changeManagerPassword(currentUser, pwCurrent, pwNew)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setPwMsg({ ok: true, text: 'Password updated.' })
      setTimeout(() => setPwMsg(null), 3000)
    } catch (err) {
      setPwMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Settings</h2>
            <p>Manage your account</p>
          </div>
          <button className="btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <h4 className="settings-section-label">Change My Password</h4>
        <form onSubmit={handleChangePassword} className="password-form">
          <label className="password-field">
            <span>Current password</span>
            <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} required autoComplete="current-password" />
          </label>
          <label className="password-field">
            <span>New password</span>
            <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} required autoComplete="new-password" />
          </label>
          <label className="password-field">
            <span>Confirm new password</span>
            <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} required autoComplete="new-password" />
          </label>
          <div className="password-actions">
            <button type="submit" className="btn-primary">Update Password</button>
            {pwMsg && <span className={pwMsg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>{pwMsg.text}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}

const SESSION_KEY = 'pss-mis:supervisor'
const GUIDE_SESSION_KEY = 'pss-mis:guide'
const MANAGER_SESSION_KEY = 'pss-mis:manager'

function parseSession(key) {
  try {
    const v = JSON.parse(sessionStorage.getItem(key))
    return v && typeof v === 'object' ? v : null
  } catch { return null }
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function App() {
  const [supervisorUser, setSupervisorUser] = useState(() => parseSession(SESSION_KEY))
  const [guideUser, setGuideUser] = useState(() => parseSession(GUIDE_SESSION_KEY))
  const [managerUser, setManagerUser] = useState(() => parseSession(MANAGER_SESSION_KEY))
  const [theme, setTheme] = useState(() => {
    const sv = parseSession(SESSION_KEY)
    const gv = parseSession(GUIDE_SESSION_KEY)
    const mv = parseSession(MANAGER_SESSION_KEY)
    const username = sv?.username || gv?.name || mv?.username
    if (username) {
      const saved = localStorage.getItem(`pss-mis:theme:${username}`)
      if (saved) return saved
    }
    return localStorage.getItem('pss-mis:theme') || 'dark'
  })
  const [role, setRole] = useState(() => {
    if (parseSession(GUIDE_SESSION_KEY)) return 'guide'
    if (parseSession(SESSION_KEY)) return 'supervisor'
    if (parseSession(MANAGER_SESSION_KEY)) return 'manager'
    return null
  })
  const [showAbout, setShowAbout] = useState(false)
  const [showGuideSettings, setShowGuideSettings] = useState(false)
  const [showSupervisorSettings, setShowSupervisorSettings] = useState(false)
  const [showManagerSettings, setShowManagerSettings] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pss-mis:theme', theme)
    const username = role === 'guide' ? guideUser?.name
      : role === 'supervisor' ? supervisorUser?.username
      : role === 'manager' ? managerUser?.username
      : null
    if (username) localStorage.setItem(`pss-mis:theme:${username}`, theme)
  }, [theme, role, guideUser, supervisorUser, managerUser])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const handleLogOut = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setSupervisorUser(null)
    setRole(null)
  }

  const handleManagerLogout = () => {
    sessionStorage.removeItem(MANAGER_SESSION_KEY)
    setManagerUser(null)
    setRole(null)
  }

  const handleGuideLogout = () => {
    sessionStorage.removeItem(GUIDE_SESSION_KEY)
    setGuideUser(null)
    setRole(null)
  }

  const handleSwitchRole = () => {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(GUIDE_SESSION_KEY)
    sessionStorage.removeItem(MANAGER_SESSION_KEY)
    setSupervisorUser(null)
    setGuideUser(null)
    setManagerUser(null)
    setRole(null)
  }

  const handleLogin = (r, userObj) => {
    if (r === 'guide') {
      sessionStorage.setItem(GUIDE_SESSION_KEY, JSON.stringify(userObj))
      setGuideUser(userObj)
    } else if (r === 'supervisor') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(userObj))
      setSupervisorUser(userObj)
    } else if (r === 'manager') {
      sessionStorage.setItem(MANAGER_SESSION_KEY, JSON.stringify(userObj))
      setManagerUser(userObj)
    }
    const username = r === 'guide' ? userObj.name : userObj.username
    const saved = localStorage.getItem(`pss-mis:theme:${username}`)
    if (saved) setTheme(saved)
    setRole(r)
  }

  if (!role) {
    return (
      <div className="role-select-screen">
        <button className="theme-toggle-float" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <img src={logo} alt="Merchant Success" className="home-logo" />
        <h1 className="home-title">CAS Performance Management</h1>
        <LoginPanel onLogin={handleLogin} />

        <section className="mis-about">
          <button className="mis-about-toggle" onClick={() => setShowAbout(v => !v)}>
            <span>About the Merchant Impact Score</span>
            <span className={`mis-about-chevron ${showAbout ? 'open' : ''}`}>&#x25BE;</span>
          </button>

          {showAbout && (
            <div className="mis-about-body">

              <div className="mis-about-section">
                <h3>Purpose and Scope</h3>
                <p>
                  The CAS Performance Management (MIS) is a monthly composite performance metric used to evaluate the
                  commercial and service impact of Technical Account Managers (TAMs) across Commerce Advanced
                  Support (CAS). MIS applies to three teams within CAS:{' '}
                  <strong>Powerseller Success (PSS)</strong>, <strong>Activations</strong>, and{' '}
                  <strong>Escalations</strong>. Each team uses three metrics specific to their role, scored against
                  monthly targets set by leadership.
                </p>
                <p>
                  All team members are required to maintain a Total MIS <strong>greater than 0</strong> each
                  calendar month. MIS scores are intended to support performance coaching and team management and
                  do not, standing alone, constitute a basis for any formal employment action outside of the
                  processes described herein.
                </p>
              </div>

              <div className="mis-about-section">
                <h3>Accountability Timeline</h3>
                <p>
                  TAMs are held accountable to the monthly MIS minimum beginning on the first day of their second
                  full calendar month on their assigned team, following completion of classroom and on-the-job
                  training. This applies to both new external hires and internal transfers from other roles within
                  Care &amp; Services. During the New Hire Training Period and prior to that first accountability
                  date, TAMs will not be held to minimum metric expectations.
                </p>
                <p>
                  TAMs who transfer between CAS teams (e.g., PSS to Escalations) are subject to a reset of this
                  accountability timeline. The clock restarts on the first day of their second full calendar month
                  on the new team, as if they were newly assigned.
                </p>
                <p className="mis-example-note">
                  Example: If a TAM is assigned to their team on October 15th, MIS accountability begins December 1st.
                </p>
              </div>

              <div className="mis-about-section">
                <h3>Powerseller Success (PSS)</h3>
                <p>
                  PSS TAMs are evaluated on volume of merchant interactions, revenue impact, and interaction quality.
                  GCR targets are split by channel — Voice TAMs and Messaging TAMs have separate targets reflecting
                  the different revenue dynamics of each channel.
                </p>
                <div className="mis-metric-list">

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Contributions Per Day (CPD)</span>
                    <p>
                      The average number of merchant interactions completed per responsible day during the calendar
                      month. Responsible days are prorated to the minute for approved time off.
                    </p>
                    <p>CPD = Total Contributions ÷ Responsible Days</p>
                    <p>Qualifying interaction types:</p>
                    <ul className="mis-calc-rules">
                      <li>Inbound and outbound phone calls</li>
                      <li>Resolved cases</li>
                      <li>Inbound front-of-site chat and SMS messages</li>
                      <li>L2 chats (internal support chats with other departments or L1 guides — not customer-facing)</li>
                    </ul>
                    <p className="mis-example-note">
                      Example: 46 calls, 316 chats, 123 resolved cases = 485 contributions over 20 days.<br />
                      CPD = 485 ÷ 20 = <strong>24.25</strong>
                    </p>
                  </div>

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Gross Cash Revenue Per Day (GCR)</span>
                    <p>
                      The average daily cash revenue generated through a TAM's merchant activity over their
                      responsible days. GCR includes new sales processed directly by the TAM through the CRM or
                      GoDaddy ecommerce system, as well as commerce revenue from campaigns not recognized through
                      new sales (e.g., GD Capital fees paid). Responsible days are prorated to the minute for
                      approved time off.
                    </p>
                    <p>GCR = Total Cash Revenue ÷ Responsible Days</p>
                    <p>
                      Voice and Messaging TAMs are evaluated against separate channel-specific targets. Each TAM's
                      score is calculated using the target corresponding to their assigned channel.
                    </p>
                    <p className="mis-example-note">
                      Example: $8,500 in new sales + $1,250 in GD Capital fees over 18.31 responsible days.<br />
                      GCR = $9,750 ÷ 18.31 = <strong>$532.49/day</strong>
                    </p>
                  </div>

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Quality Assurance Score (QA)</span>
                    <p>
                      The average score across a minimum of four randomly selected interaction reviews conducted
                      by leadership during the calendar month.
                    </p>
                    <p>QA = Sum of Review Scores ÷ Number of Reviews</p>
                    <p className="mis-example-note">
                      Example: Reviews of 80, 85, 100, and 50.<br />
                      QA = 315 ÷ 4 = <strong>78.75%</strong>
                    </p>
                  </div>

                </div>

                <p>PSS metric weights and point ranges:</p>
                <table className="mis-rails-table">
                  <thead>
                    <tr><th>Metric</th><th>Weight</th><th>Min Points</th><th>Max Points</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>CPD</td><td>1.5×</td><td>−35</td><td>+35</td></tr>
                    <tr><td>GCR</td><td>1.0×</td><td>−20</td><td>+20</td></tr>
                    <tr><td>QA</td><td>1.0×</td><td>−20</td><td>+20</td></tr>
                    <tr className="mis-rails-total"><td>Total MIS</td><td></td><td>−75</td><td>+75</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="mis-about-section">
                <h3>Activations</h3>
                <p>
                  Activations TAMs are evaluated on their ability to win revenue opportunities, sustain activation
                  volume, and maintain quality standards. All three metrics carry equal weight. The AQI metric is
                  synced from activation reviews — a minimum of four reviews is required for a complete score.
                </p>
                <div className="mis-metric-list">

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">aGPV Win Rate</span>
                    <p>
                      Determined by the percent of qualified, signed, and handed-off GPV (by dollar amount) that ends
                      up being marked won.
                    </p>
                    <p>aGPV Win Rate = Won aGPV ($) ÷ Total Qualified aGPV ($) × 100</p>
                  </div>

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Work Orders Per Day</span>
                    <p>
                      The average number of work orders completed per responsible day during the calendar month.
                      Responsible days are prorated to the minute for approved time off.
                    </p>
                    <p>Work Orders/Day = Total Work Orders ÷ Responsible Days</p>
                  </div>

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Activation Quality Index (AQI)</span>
                    <p>
                      The average quality score across a minimum of four activation reviews conducted by leadership
                      during the calendar month. AQI is synced automatically from the AQI Reviews tab.
                    </p>
                    <p>AQI = Sum of Review Scores ÷ Number of Reviews</p>
                  </div>

                </div>

                <p>Activations metric weights and point ranges:</p>
                <table className="mis-rails-table">
                  <thead>
                    <tr><th>Metric</th><th>Weight</th><th>Min Points</th><th>Max Points</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>aGPV Win Rate</td><td>1.0×</td><td>−25</td><td>+25</td></tr>
                    <tr><td>Work Orders/Day</td><td>1.0×</td><td>−25</td><td>+25</td></tr>
                    <tr><td>AQI</td><td>1.0×</td><td>−25</td><td>+25</td></tr>
                    <tr className="mis-rails-total"><td>Total MIS</td><td></td><td>−75</td><td>+75</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="mis-about-section">
                <h3>Escalations</h3>
                <p>
                  Escalations TAMs are evaluated on case closure volume, resolution effectiveness, and non-queue
                  work output. Guide level affects targets for case closures and non-queue work — Level 1
                  and Level 2 guides are held to different targets reflecting their workload profile.
                  QA reviews are tracked for coaching purposes but are <strong>not</strong> included in the MIS
                  score calculation for Escalations.
                </p>
                <div className="mis-metric-list">

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Case Closures Per Day</span>
                    <p>
                      The average number of escalation cases closed per responsible day during the calendar month.
                      Responsible days are prorated to the minute for approved time off.
                    </p>
                    <p>Case Closures/Day = Total Cases Closed ÷ Responsible Days</p>
                    <p className="mis-example-note">Level 1 target: 8/day &nbsp;·&nbsp; Level 2 target: 5/day</p>
                  </div>

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Resolution Rate</span>
                    <p>
                      Determined by the proportion of escalated cases that have been successfully marked as resolved,
                      based on the total number of escalated cases. Resolution is determined by the case status
                      recorded in the ticketing system.
                    </p>
                    <p>Resolution Rate = Cases Resolved ÷ Total Escalated Cases × 100</p>
                  </div>

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Non-Queue Contributions Per Day</span>
                    <p>
                      Manually tracked by each team member and recorded whenever they engage in activities beyond
                      standard ticket queues. These efforts contribute to the ongoing improvement of the department
                      and the overall product. Common examples include submitting bug reports, conducting product
                      testing, and enhancing the team knowledge base.
                    </p>
                    <p>Non-Queue Work/Day = Total Non-Queue Contributions ÷ Responsible Days</p>
                    <p className="mis-example-note">Level 1 target: 12/day &nbsp;·&nbsp; Level 2 target: 5/day</p>
                  </div>

                </div>

                <p>Escalations metric weights and point ranges:</p>
                <table className="mis-rails-table">
                  <thead>
                    <tr><th>Metric</th><th>Weight</th><th>Min Points</th><th>Max Points</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Case Closures/Day</td><td>1.0×</td><td>−25</td><td>+25</td></tr>
                    <tr><td>Resolution Rate</td><td>1.0×</td><td>−25</td><td>+25</td></tr>
                    <tr><td>Non-Queue Contributions/Day</td><td>1.0×</td><td>−25</td><td>+25</td></tr>
                    <tr className="mis-rails-total"><td>Total MIS</td><td></td><td>−75</td><td>+75</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="mis-about-section">
                <h3>Score Calculation</h3>
                <p>
                  The formula is the same across all three teams. Each metric is scored by measuring percentage
                  deviation from its monthly target, multiplied by a metric-specific weight, then clamped to the
                  metric's point rail. Performing exactly at target earns 0 points.
                </p>
                <div className="mis-formula-block">
                  <div className="mis-formula-row">
                    <span className="mis-formula-label">Per metric</span>
                    <span className="mis-formula-expr">((actual ÷ target) − 1) × 100 × weight &nbsp;[clamped to rail]</span>
                  </div>
                  <div className="mis-formula-row mis-formula-total">
                    <span className="mis-formula-label">Total MIS</span>
                    <span className="mis-formula-expr">sum of all metric points</span>
                  </div>
                </div>
                <p>
                  Each metric's point value is rounded to the nearest hundredth before summing.
                  The Total MIS is then independently rounded to the nearest hundredth.
                </p>
                <p>
                  Monthly scores are finalized and published to TAMs within 5 business days of the close of each
                  calendar month.
                </p>

                <p className="mis-subsection-label">PSS Example — On Track</p>
                <p className="mis-example-note">
                  Monthly targets: CPD 17 &nbsp;·&nbsp; GCR $70/day &nbsp;·&nbsp; QA 85%
                </p>
                <table className="mis-example-table">
                  <thead>
                    <tr><th>Metric</th><th>Target</th><th>Result</th><th>Calculation</th><th>Points</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>CPD</td><td>17</td><td>19</td>
                      <td className="mis-calc-cell">((19 ÷ 17) − 1) × 100 × 1.5</td>
                      <td className="mis-pts-pos">+17.65</td>
                    </tr>
                    <tr>
                      <td>GCR</td><td>$70</td><td>$85</td>
                      <td className="mis-calc-cell">((85 ÷ 70) − 1) × 100 × 1.0</td>
                      <td className="mis-pts-pos">+21.43</td>
                    </tr>
                    <tr>
                      <td>QA</td><td>85%</td><td>92%</td>
                      <td className="mis-calc-cell">((92 ÷ 85) − 1) × 100 × 1.0</td>
                      <td className="mis-pts-pos">+8.24</td>
                    </tr>
                    <tr className="mis-example-total">
                      <td colSpan={4}>Total MIS</td>
                      <td><span className="mis-status-on">+47.32 — On Track ✓</span></td>
                    </tr>
                  </tbody>
                </table>

                <p className="mis-subsection-label">Escalations Example — TAM 3, Off Track</p>
                <p className="mis-example-note">
                  Monthly targets: Case Closures 5/day &nbsp;·&nbsp; Resolution Rate 60% &nbsp;·&nbsp; Non-Queue Contributions 5/day
                </p>
                <table className="mis-example-table">
                  <thead>
                    <tr><th>Metric</th><th>Target</th><th>Result</th><th>Calculation</th><th>Points</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Case Closures/Day</td><td>5</td><td>4.2</td>
                      <td className="mis-calc-cell">((4.2 ÷ 5) − 1) × 100 × 1.0</td>
                      <td className="mis-pts-neg">−16.00</td>
                    </tr>
                    <tr>
                      <td>Resolution Rate</td><td>60%</td><td>57%</td>
                      <td className="mis-calc-cell">((57 ÷ 60) − 1) × 100 × 1.0</td>
                      <td className="mis-pts-neg">−5.00</td>
                    </tr>
                    <tr>
                      <td>Non-Queue Contributions/Day</td><td>5</td><td>4.5</td>
                      <td className="mis-calc-cell">((4.5 ÷ 5) − 1) × 100 × 1.0</td>
                      <td className="mis-pts-neg">−10.00</td>
                    </tr>
                    <tr className="mis-example-total">
                      <td colSpan={4}>Total MIS</td>
                      <td><span className="mis-status-off">−31.00 — Off Track ✗</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mis-about-section">
                <h3>Minimum Performance Expectations</h3>
                <p>
                  All team members must achieve a Total MIS <strong>greater than 0</strong> each calendar month.
                  A TAM whose Total MIS is above 0 is designated{' '}
                  <strong className="mis-status-on">On Track</strong> and has satisfied the monthly MIS minimum
                  expectation.
                </p>
                <p>
                  A TAM whose Total MIS is 0 or below is designated{' '}
                  <strong className="mis-status-off">Off Track</strong> and will be subject to the Performance
                  Improvement Process.
                </p>
                <div className="mis-callout mis-callout-neutral">
                  <strong>Performance Improvement Plan (PIP)</strong>
                  <p>
                    A PIP will be issued when a TAM fails to meet the minimum MIS expectation for a calendar month.
                    TAMs are permitted no more than two PIPs within any rolling 12-month period. A successfully
                    completed PIP rolls off 12 months after its issue date. Failure to achieve the goals outlined
                    in a PIP, or any extension thereof, may result in transfer or termination of employment at
                    GoDaddy's discretion.
                  </p>
                </div>
              </div>

              <div className="mis-about-section">
                <h3>Confidentiality and Appropriate Use</h3>
                <p>
                  Individual MIS scores and the underlying performance data are confidential. Access is restricted
                  to the individual TAM to whom the score applies, their direct supervisors, and authorized
                  leadership and HR partners within the organization.
                  Permitted uses include:
                </p>
                <ul className="mis-calc-rules">
                  <li>Monthly individual performance coaching conversations</li>
                  <li>Team performance trend analysis and operational planning</li>
                  <li>Supporting documentation in structured performance management processes, where applicable</li>
                </ul>
                <p>
                  MIS scores must not be shared with unauthorized parties or used for purposes outside those
                  described above. This document is not a contract. GoDaddy reserves the right to change, modify,
                  or suspend these guidelines and their application to any individual employee at its sole
                  discretion and at any time without notice.
                </p>
              </div>

            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>CAS Performance Management</h1>
        {(() => {
          const displayName = role === 'guide' ? guideUser?.name : role === 'supervisor' ? supervisorUser?.username : managerUser?.username
          const initial = displayName?.[0]?.toUpperCase() ?? '?'
          const onSettings = role === 'guide' ? () => setShowGuideSettings(true) : role === 'supervisor' ? () => setShowSupervisorSettings(true) : () => setShowManagerSettings(true)
          const onLogout = role === 'guide' ? handleGuideLogout : role === 'supervisor' ? handleLogOut : handleManagerLogout
          return (
            <div className="header-actions">
              <div className="header-user">
                <span className="header-avatar">{initial}</span>
                <span className="header-username">{displayName}</span>
              </div>
              <button className="header-theme-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              <button className="header-settings-btn" title="Settings" onClick={onSettings}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
                  <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
                  <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
                </svg>
              </button>
              <div className="header-divider" />
              <button className="header-logout-btn" onClick={onLogout}>Log out</button>
            </div>
          )
        })()}
      </header>
      {showGuideSettings && guideUser && (
        <GuideSettingsModal guideName={guideUser.name} onClose={() => setShowGuideSettings(false)} />
      )}
      {showSupervisorSettings && supervisorUser && (
        <SupervisorSettingsModal currentUser={supervisorUser.username} onClose={() => setShowSupervisorSettings(false)} />
      )}
      {showManagerSettings && managerUser && (
        <ManagerSettingsModal currentUser={managerUser.username} onClose={() => setShowManagerSettings(false)} />
      )}
      <main>
        {role === 'guide'
          ? <GuideView team={guideUser?.team} guideUser={guideUser?.name} />
          : role === 'manager'
            ? <ManagerView leaderUser={managerUser} canManageUsers={true} onLogout={handleManagerLogout} />
            : <ManagerView leaderUser={supervisorUser} canManageUsers={false} onLogout={handleLogOut} />
        }
      </main>
    </div>
  )
}
