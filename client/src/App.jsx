import { useState, useEffect } from 'react'
import GuideView from './components/GuideView'
import SupervisorView from './components/SupervisorView'
import { getCurrentUser, isSupervisor, getConfig } from './utils/sharepoint'
import './App.css'

const DEFAULT_CONFIG = {
  month: new Date().toISOString().slice(0, 7),
  cpd:          { min: 14, target: 17, max: 20  },
  gcrVoice:     { min: 40, target: 70, max: 100 },
  gcrMessaging: { min: 15, target: 30, max: 60  },
  qa:           { min: 70, target: 85, max: 100 },
}

export default function App() {
  const [state, setState] = useState('loading') // loading | supervisor | guide | error
  const [currentUser, setCurrentUser] = useState(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function init() {
      try {
        const user = await getCurrentUser()
        setCurrentUser(user)
        const supervisor = await isSupervisor(user.email)
        const month = new Date().toISOString().slice(0, 7)
        const cfg = await getConfig(month)
        if (cfg) setConfig(cfg)
        setState(supervisor ? 'supervisor' : 'guide')
      } catch (err) {
        setErrorMsg(`Failed to connect to SharePoint: ${err.message}`)
        setState('error')
      }
    }
    init()
  }, [])

  if (state === 'loading') {
    return (
      <div className="role-select-screen">
        <div className="loading-msg">Loading…</div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="role-select-screen">
        <div className="password-card">
          <h2>Connection Error</h2>
          <p className="gate-error">{errorMsg}</p>
          <p className="subtext">Make sure you are accessing this app from within SharePoint.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>PSS Merchant Impact Score</h1>
        <span className="header-user">{currentUser?.name}</span>
      </header>
      <main>
        {state === 'supervisor'
          ? <SupervisorView
              config={config}
              onConfigSave={setConfig}
              currentUser={currentUser}
            />
          : <GuideView
              config={config}
              currentUser={currentUser}
            />
        }
      </main>
    </div>
  )
}
