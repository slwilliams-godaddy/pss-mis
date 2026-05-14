import { useState, useEffect, useRef } from 'react'
import { calculateMIS } from '../utils/misCalculator'
import {
  getTeam, saveTeam, deleteGuideRow, closeMonth,
  getArchivedMonths, getArchivedMonth, upsertArchivedMonth,
  saveConfig,
  getSupervisorUsernames, addSupervisorUser, removeSupervisorUser, changeSupervisorPassword,
} from '../utils/storage'

const EMPTY_GUIDE = { name: '', email: '', channel: 'voice', cpdMode: 'perday', cpd: '', gcrMode: 'perday', gcr: '', qa: '', days: '' }
const CONFIG_METRICS = [
  { key: 'cpd',          label: 'CPD',            prefix: '',  suffix: ''  },
  { key: 'gcrVoice',     label: 'GCR (Voice)',     prefix: '$', suffix: ''  },
  { key: 'gcrMessaging', label: 'GCR (Messaging)', prefix: '$', suffix: ''  },
  { key: 'qa',           label: 'QA',              prefix: '',  suffix: '%' },
]
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const fmtMonth = (m) => { const [y, mm] = m.split('-'); return `${MONTH_NAMES[+mm - 1]} ${y}` }

function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function Sparkline({ values, color, width = 130, height = 40 }) {
  if (values.length < 2) return <span className="sparkline-empty">not enough data</span>
  const pad = 4
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  const toY = (v) => height - pad - ((v - min) / range) * (height - pad * 2)
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    return `${x.toFixed(1)},${toY(v).toFixed(1)}`
  }).join(' ')
  const lastX = (width - pad).toFixed(1)
  const lastY = toY(values[values.length - 1]).toFixed(1)
  const zeroY = toY(0).toFixed(1)
  return (
    <svg width={width} height={height}>
      <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="#475569" strokeWidth="1" strokeDasharray="3 2" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={color} />
    </svg>
  )
}

export default function SupervisorView({ config, onConfigSave, currentUser }) {
  const [tab, setTab] = useState('input')

  // Input tab
  const [inputMonth, setInputMonth] = useState(config.month)
  const [inputGuides, setInputGuides] = useState([{ ...EMPTY_GUIDE }])
  const [inputConfig, setInputConfig] = useState({ ...config })
  const [inputResults, setInputResults] = useState(null)
  const [inputSaveStatus, setInputSaveStatus] = useState(null)
  const [inputLoading, setInputLoading] = useState(false)
  const [editingInputConfig, setEditingInputConfig] = useState(false)
  const [inputConfigDraft, setInputConfigDraft] = useState({ ...config })
  const [inputConfigMsg, setInputConfigMsg] = useState('')
  const [closeMonthMsg, setCloseMonthMsg] = useState('')
  const [saveMonthMsg, setSaveMonthMsg] = useState('')
  const [rosterPickMonth, setRosterPickMonth] = useState('')
  const [showRosterPicker, setShowRosterPicker] = useState(false)
  const [editingGuides, setEditingGuides] = useState(false)
  const inputLoaded = useRef(false)

  // Archive list (shared)
  const [archivedMonths, setArchivedMonths] = useState(null)

  // Trend tabs
  const [trendGuide, setTrendGuide] = useState('')
  const [allArchiveData, setAllArchiveData] = useState(null)

  const [showSettings, setShowSettings] = useState(false)
  const [supervisorUsers, setSupervisorUsers] = useState([])
  const [supervisorsLoading, setSupervisorsLoading] = useState(false)

  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState(null)

  const [newUsername, setNewUsername] = useState('')
  const [newUserPw, setNewUserPw] = useState('')
  const [addUserMsg, setAddUserMsg] = useState(null)

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

  const handleAddUser = async (e) => {
    e.preventDefault()
    try {
      await addSupervisorUser(newUsername.trim(), newUserPw)
      const names = await getSupervisorUsernames()
      setSupervisorUsers(names)
      setNewUsername(''); setNewUserPw('')
      setAddUserMsg({ ok: true, text: `${newUsername.trim()} added.` })
      setTimeout(() => setAddUserMsg(null), 3000)
    } catch (err) {
      setAddUserMsg({ ok: false, text: err.message })
    }
  }

  const handleRemoveUser = async (username) => {
    try {
      await removeSupervisorUser(username)
      const names = await getSupervisorUsernames()
      setSupervisorUsers(names)
    } catch (err) {
      setAddUserMsg({ ok: false, text: err.message })
    }
  }

  const openSettings = async () => {
    setShowSettings(true)
    setPwMsg(null)
    setSupervisorsLoading(true)
    try {
      const names = await getSupervisorUsernames()
      setSupervisorUsers(names)
    } catch { /* non-critical */ }
    setSupervisorsLoading(false)
  }

  const isCurrentMonth = inputMonth === config.month

  const allInputMonths = (() => {
    const set = new Set(archivedMonths || [])
    set.add(config.month)
    set.add(addMonths(config.month, 1))
    set.add(addMonths(config.month, 2))
    set.add(addMonths(config.month, 3))
    return [...set].sort().reverse()
  })()

  const calcResults = (guides, cfg) => guides.map(g => {
    const days = parseFloat(g.days)
    const needsDays = g.cpdMode === 'total' || g.gcrMode === 'total'
    if (needsDays && isNaN(days)) return null
    const cpd = g.cpdMode === 'total' ? parseFloat(g.cpd) / days : parseFloat(g.cpd)
    const gcr = g.gcrMode === 'total' ? parseFloat(g.gcr) / days : parseFloat(g.gcr)
    const actuals = { cpd, gcr, qa: parseFloat(g.qa) }
    if (Object.values(actuals).some(isNaN)) return null
    const gcrCfg = g.channel === 'messaging' ? (cfg.gcrMessaging ?? cfg.gcrVoice) : (cfg.gcrVoice ?? cfg.gcr)
    return { name: g.name || 'Unknown', channel: g.channel || 'voice', actuals, ...calculateMIS(actuals, { ...cfg, gcr: gcrCfg }) }
  })

  const scoreColor = (score) => score > 0 ? '#22c55e' : score === 0 ? '#f59e0b' : '#ef4444'
  const fmtSigned = (v) => { const n = parseFloat(Number(v).toFixed(2)); return (n > 0 ? '+' : '') + n }

  const fetchArchivedMonths = async () => {
    try {
      const months = await getArchivedMonths()
      setArchivedMonths(months)
    } catch {
      setArchivedMonths([])
    }
  }

  useEffect(() => { fetchArchivedMonths() }, [])

  useEffect(() => { setAllArchiveData(null) }, [archivedMonths])

  useEffect(() => {
    if ((tab !== 'trend' && tab !== 'team-trend') || allArchiveData !== null || !archivedMonths?.length) return
    let cancelled = false
    ;(async () => {
      const map = {}
      for (const m of archivedMonths) {
        try {
          const data = await getArchivedMonth(m)
          if (data) map[m] = data
        } catch { /* skip */ }
      }
      if (!cancelled) setAllArchiveData(map)
    })()
    return () => { cancelled = true }
  }, [tab, archivedMonths])

  const loadInputMonth = async (month) => {
    setInputLoading(true)
    inputLoaded.current = false
    setInputResults(null)
    setEditingGuides(false)
    setCloseMonthMsg('')
    setSaveMonthMsg('')
    setInputConfigMsg('')
    setEditingInputConfig(false)
    setShowRosterPicker(false)

    try {
      if (month === config.month) {
        const data = await getTeam(month)
        if (data.guides?.length > 0 && data.guides.some(g => g.name)) {
          setInputGuides(data.guides)
        } else {
          setInputGuides([{ ...EMPTY_GUIDE }])
          setShowRosterPicker(true)
        }
        setInputConfig({ ...config })
        setInputConfigDraft({ ...config })
      } else if ((archivedMonths || []).includes(month)) {
        const data = await getArchivedMonth(month)
        if (data) {
          setInputGuides(data.guides?.length ? data.guides : [{ ...EMPTY_GUIDE }])
          setInputConfig(data.config ? { ...data.config } : { ...config })
          setInputConfigDraft(data.config ? { ...data.config } : { ...config })
          setInputResults(data.results?.length ? data.results : null)
        } else {
          setInputGuides([{ ...EMPTY_GUIDE }])
        }
      } else {
        // Future month: pre-fill names from current month, empty actuals
        const data = await getTeam(config.month)
        const guides = data.guides?.filter(g => g.name).map(g => ({ ...EMPTY_GUIDE, name: g.name, email: g.email, channel: g.channel || 'voice' }))
        setInputGuides(guides?.length ? guides : [{ ...EMPTY_GUIDE }])
        setInputConfig({ ...config, month })
        setInputConfigDraft({ ...config, month })
      }
    } catch (err) {
      console.error('Error loading month:', err)
      setInputGuides([{ ...EMPTY_GUIDE }])
    }

    setInputLoading(false)
    inputLoaded.current = true
  }

  useEffect(() => { loadInputMonth(inputMonth) }, [inputMonth])

  // Debounced auto-save for current month
  useEffect(() => {
    if (!inputLoaded.current || !isCurrentMonth) return
    setInputSaveStatus('saving')
    const timer = setTimeout(async () => {
      try {
        await saveTeam(config.month, inputGuides)
        setInputSaveStatus('saved')
      } catch {
        setInputSaveStatus('error')
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [inputGuides])

  const handleGuideChange = (i, field, value) => {
    setInputGuides(inputGuides.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
    setInputResults(null)
  }

  const toggleMetricMode = (i, metric) => {
    setInputGuides(inputGuides.map((g, idx) => idx === i
      ? { ...g, [`${metric}Mode`]: g[`${metric}Mode`] === 'perday' ? 'total' : 'perday', [metric]: '' }
      : g))
    setInputResults(null)
  }

  const handleCalculate = (e) => {
    e && e.preventDefault()
    setInputResults(calcResults(inputGuides, inputConfig))
  }

  const handleSaveMonth = async () => {
    setSaveMonthMsg('')
    const results = calcResults(inputGuides, inputConfig)
    try {
      const updated = await upsertArchivedMonth(inputMonth, { guides: inputGuides, config: inputConfig })
      setInputResults(updated.results || null)
      setSaveMonthMsg('Saved.')
      setEditingGuides(false)
      setAllArchiveData(null)
      fetchArchivedMonths()
    } catch (err) { setSaveMonthMsg(`Error: ${err.message}`) }
  }

  const handleCloseMonth = async () => {
    setCloseMonthMsg('')
    try {
      // Save current state first, then close
      await saveTeam(config.month, inputGuides)
      await closeMonth(config.month)
      inputLoaded.current = false
      // Reset to empty roster for next month
      const nextGuides = inputGuides.map(g => ({
        ...EMPTY_GUIDE, name: g.name, email: g.email, channel: g.channel || 'voice',
      }))
      setInputGuides(nextGuides)
      setInputResults(null)
      setInputSaveStatus(null)
      inputLoaded.current = true
      setCloseMonthMsg(`${config.month} archived.`)
      fetchArchivedMonths()
    } catch (err) { setCloseMonthMsg(`Error: ${err.message}`) }
  }

  const handleSaveInputConfig = async (e) => {
    e.preventDefault()
    setInputConfigMsg('')
    if (isCurrentMonth) {
      try {
        await onConfigSave(inputConfigDraft)
        setInputConfig({ ...inputConfigDraft })
        setEditingInputConfig(false)
        setInputConfigMsg('Config saved.')
      } catch (err) { setInputConfigMsg(`Error: ${err.message}`) }
    } else {
      try {
        const updated = await upsertArchivedMonth(inputMonth, { guides: inputGuides, config: inputConfigDraft })
        setInputConfig({ ...updated.config })
        setInputConfigDraft({ ...updated.config })
        setInputResults(updated.results || null)
        setEditingInputConfig(false)
        setInputConfigMsg('Config saved.')
        setAllArchiveData(null)
      } catch (err) { setInputConfigMsg(`Error: ${err.message}`) }
    }
  }

  const handleLoadRoster = async (month) => {
    if (!month) return
    try {
      const data = await getArchivedMonth(month)
      if (!data?.guides?.length) return
      inputLoaded.current = false
      setInputGuides(data.guides.map(g => ({ ...EMPTY_GUIDE, name: g.name, email: g.email || '', channel: g.channel || 'voice' })))
      setInputResults(null)
      setShowRosterPicker(false)
      inputLoaded.current = true
    } catch { /* ignore */ }
  }

  const handleRemoveGuide = async (i) => {
    if (inputGuides.length === 1) return
    const guide = inputGuides[i]
    if (guide.id) {
      try { await deleteGuideRow(guide.id) } catch { /* best effort */ }
    }
    setInputGuides(inputGuides.filter((_, idx) => idx !== i))
    setInputResults(null)
  }

  const exportCSV = () => {
    const results = inputResults
    if (!results) return
    const header = 'Name,Email,CPD (per day),CPD Points,GCR (per day),GCR Points,QA (%),QA Points,Total MIS,Status'
    const rows = results.map((r, i) => {
      if (!r) return ''
      const email = inputGuides[i]?.email || ''
      return `${r.name},${email},${r.actuals.cpd.toFixed(2)},${r.cpd},${r.actuals.gcr.toFixed(2)},${r.gcr},${r.actuals.qa.toFixed(1)}%,${r.qa},${r.total},${r.passing ? 'On Track' : 'Off Track'}`
    })
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Team_MIS_${inputMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Trend derived values
  const allGuideNames = allArchiveData
    ? [...new Set(Object.values(allArchiveData).flatMap(d => (d.results || []).filter(Boolean).map(r => r.name)))].sort()
    : []

  const trendRows = trendGuide && allArchiveData
    ? Object.entries(allArchiveData)
        .map(([month, data]) => {
          const result = data.results?.find(r => r?.name === trendGuide)
          return result ? { month, ...result } : null
        })
        .filter(Boolean)
        .sort((a, b) => a.month.localeCompare(b.month))
    : []

  const cpdPts  = trendRows.map(r => r.cpd)
  const gcrPts  = trendRows.map(r => r.gcr)
  const qaPts   = trendRows.map(r => r.qa)
  const cpdVals = trendRows.map(r => r.actuals.cpd)
  const gcrVals = trendRows.map(r => r.actuals.gcr)
  const qaVals  = trendRows.map(r => r.actuals.qa)
  const misVals = trendRows.map(r => r.total)

  const teamTrendRows = allArchiveData
    ? Object.entries(allArchiveData)
        .filter(([, data]) => data.averages)
        .map(([month, data]) => ({ month, ...data.averages }))
        .sort((a, b) => a.month.localeCompare(b.month))
    : []

  const trendDelta = (arr) => arr.length >= 2 ? arr[arr.length - 1] - arr[arr.length - 2] : null

  const isFuture = inputMonth !== config.month && !(archivedMonths || []).includes(inputMonth)

  return (
    <div className="view-container">
      <div className="supervisor-header">
        <h2>Supervisor Dashboard</h2>
        <button className="btn-gear" title="Settings" onClick={openSettings}>⚙</button>
      </div>

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>Settings</h3>
              <button className="btn-ghost settings-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <h4>Change My Password</h4>
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

            <div className="settings-divider" />

            <h4>Supervisor Users</h4>
            {supervisorsLoading ? (
              <p className="subtext">Loading…</p>
            ) : (
              <ul className="user-list">
                {supervisorUsers.map(u => (
                  <li key={u} className="user-list-item">
                    <span>{u}{u === currentUser && <span className="user-you"> (you)</span>}</span>
                    {u !== currentUser && (
                      <button className="btn-ghost user-remove-btn" onClick={() => handleRemoveUser(u)}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddUser} className="password-form">
              <label className="password-field">
                <span>Username</span>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
              <label className="password-field">
                <span>Password</span>
                <input
                  type="password"
                  value={newUserPw}
                  onChange={e => setNewUserPw(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </label>
              <div className="password-actions">
                <button type="submit" className="btn-secondary">Add User</button>
                {addUserMsg && <span className={addUserMsg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>{addUserMsg.text}</span>}
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="tabs">
        {[['input', 'Input'], ['team-trend', 'Team Trend'], ['trend', 'Guide Trend']].map(([t, label]) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── INPUT TAB ── */}
      {tab === 'input' && (
        <div className="history-tab">
          {/* Month selector */}
          <div className="history-controls">
            <label className="history-month-select">
              <span>Month</span>
              <select value={inputMonth} onChange={e => setInputMonth(e.target.value)}>
                {allInputMonths.map(m => (
                  <option key={m} value={m}>
                    {fmtMonth(m)}{m === config.month ? ' (current)' : isFuture && m === inputMonth ? ' (future)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {inputResults && (
              <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
            )}
          </div>

          {inputLoading && <p className="subtext">Loading…</p>}

          {!inputLoading && (
            <>
              {/* Config section */}
              <div className="history-section">
                <div className="history-section-header">
                  <h4>Config — {fmtMonth(inputMonth)}</h4>
                  {!editingInputConfig && (
                    <button className="btn-ghost" onClick={() => { setEditingInputConfig(true); setInputConfigDraft({ ...inputConfig }); setInputConfigMsg('') }}>
                      Edit Config
                    </button>
                  )}
                </div>
                {editingInputConfig ? (
                  <form onSubmit={handleSaveInputConfig} className="history-config-form">
                    {isCurrentMonth && (
                      <div className="history-config-edit-row">
                        <span className="history-config-metric-label">Month</span>
                        <div className="month-selects">
                          <select
                            value={inputConfigDraft.month ? inputConfigDraft.month.split('-')[1] : ''}
                            onChange={e => {
                              const [year] = (inputConfigDraft.month || '-').split('-')
                              setInputConfigDraft({ ...inputConfigDraft, month: `${year}-${e.target.value}` })
                            }}
                            required
                          >
                            <option value="">Month</option>
                            {MONTH_NAMES.map((name, i) => (
                              <option key={i} value={String(i + 1).padStart(2, '0')}>{name}</option>
                            ))}
                          </select>
                          <select
                            value={inputConfigDraft.month ? inputConfigDraft.month.split('-')[0] : ''}
                            onChange={e => {
                              const [, month] = (inputConfigDraft.month || '-').split('-')
                              setInputConfigDraft({ ...inputConfigDraft, month: `${e.target.value}-${month || '01'}` })
                            }}
                            required
                          >
                            <option value="">Year</option>
                            {[2025, 2026, 2027, 2028].map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {CONFIG_METRICS.map(({ key, label }) => (
                      <div key={key} className="history-config-edit-row">
                        <span className="history-config-metric-label">{label}</span>
                        {['min', 'target', 'max'].map(field => (
                          <label key={field} className="history-config-field">
                            <span>{field}</span>
                            <input
                              type="number"
                              value={inputConfigDraft[key]?.[field] ?? ''}
                              onChange={e => setInputConfigDraft({
                                ...inputConfigDraft,
                                [key]: { ...inputConfigDraft[key], [field]: parseFloat(e.target.value) || e.target.value }
                              })}
                              step="0.01"
                              required
                            />
                          </label>
                        ))}
                      </div>
                    ))}
                    <div className="history-config-form-actions">
                      <button type="submit" className="btn-primary">{isCurrentMonth ? 'Save Config' : 'Save & Recalculate'}</button>
                      <button type="button" className="btn-ghost" onClick={() => { setEditingInputConfig(false); setInputConfigDraft({ ...inputConfig }); setInputConfigMsg('') }}>Cancel</button>
                      {inputConfigMsg && <span className="close-month-msg">{inputConfigMsg}</span>}
                    </div>
                  </form>
                ) : (
                  <div className="history-config-display">
                    {CONFIG_METRICS.map(({ key, label, prefix, suffix }) => {
                      const c = inputConfig[key]
                      if (!c) return null
                      return (
                        <div key={key} className="history-config-row">
                          <span className="history-config-metric-label">{label}</span>
                          <span className="history-config-threshold">
                            <span className="cfg-muted">{prefix}{c.min}{suffix}</span>
                            <span className="cfg-sep">·</span>
                            <span className="cfg-target">{prefix}{c.target}{suffix}</span>
                            <span className="cfg-sep">·</span>
                            <span className="cfg-muted">{prefix}{c.max}{suffix}</span>
                          </span>
                          <span className="cfg-hint">min · target · max</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Roster picker for current month (new month) */}
              {isCurrentMonth && showRosterPicker && (
                <div className="new-month-banner">
                  <span>Import guide names from a previous month?</span>
                  <div className="new-month-controls">
                    <select
                      value={rosterPickMonth}
                      onChange={e => setRosterPickMonth(e.target.value)}
                      disabled={!archivedMonths?.length}
                    >
                      <option value="">— select month —</option>
                      {(archivedMonths || []).map(m => (
                        <option key={m} value={m}>{fmtMonth(m)}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-secondary" disabled={!rosterPickMonth} onClick={() => handleLoadRoster(rosterPickMonth)}>
                      Import Names
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setShowRosterPicker(false)}>
                      Start Fresh
                    </button>
                  </div>
                </div>
              )}

              {/* Team averages (archived months with data) */}
              {!isCurrentMonth && !isFuture && inputResults && (() => {
                const valid = inputResults.filter(Boolean)
                if (!valid.length) return null
                const avg = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100
                const avgs = {
                  cpd: avg(valid.map(r => r.actuals.cpd)),
                  gcr: avg(valid.map(r => r.actuals.gcr)),
                  qa: avg(valid.map(r => r.actuals.qa)),
                  cpdPts: avg(valid.map(r => r.cpd)),
                  gcrPts: avg(valid.map(r => r.gcr)),
                  qaPts: avg(valid.map(r => r.qa)),
                  total: avg(valid.map(r => r.total)),
                  passRate: Math.round(valid.filter(r => r.passing).length / valid.length * 100) / 100,
                  count: valid.length,
                }
                return (
                  <div className="history-section">
                    <h4>Team Averages</h4>
                    <div className="history-averages">
                      {[
                        { label: 'Avg CPD', val: `${avgs.cpd.toFixed(2)}/day`, pts: avgs.cpdPts },
                        { label: 'Avg GCR', val: `$${avgs.gcr.toFixed(2)}/day`, pts: avgs.gcrPts },
                        { label: 'Avg QA',  val: `${avgs.qa.toFixed(1)}%`,       pts: avgs.qaPts },
                        { label: 'Avg MIS', val: fmtSigned(avgs.total), pts: null },
                      ].map(({ label, val, pts }) => (
                        <div key={label} className="hist-avg-stat">
                          <span className="hist-avg-label">{label}</span>
                          <span className="hist-avg-val">{val}</span>
                          {pts != null && <span className="hist-avg-pts" style={{ color: scoreColor(pts) }}>{pts > 0 ? '+' : ''}{pts} pts</span>}
                        </div>
                      ))}
                      <div className="hist-avg-stat">
                        <span className="hist-avg-label">Pass Rate</span>
                        <span className={`pass-badge small ${avgs.passRate >= 0.5 ? 'pass' : 'fail'}`}>
                          {Math.round(avgs.passRate * avgs.count)}/{avgs.count} ({Math.round(avgs.passRate * 100)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Guide data entry + results */}
              <div className="results-card">
                <div className="results-header">
                  <h3>
                    {isFuture ? `Guides — ${fmtMonth(inputMonth)}` : isCurrentMonth ? `${fmtMonth(inputMonth)} — In Progress` : `${fmtMonth(inputMonth)} Team Results`}
                  </h3>
                  {isCurrentMonth && inputSaveStatus && (
                    <span className={`save-status ${inputSaveStatus}`}>
                      {inputSaveStatus === 'saving' ? 'Saving…' : inputSaveStatus === 'saved' ? 'Saved' : 'Save failed'}
                    </span>
                  )}
                </div>

                {(isCurrentMonth || isFuture || editingGuides) ? (
                  <>
                    <div className="bulk-table-wrap">
                      <table className="bulk-input-table">
                        <thead>
                          <tr>
                            <th>Guide Name</th>
                            <th>Email</th>
                            <th>Channel</th>
                            <th>CPD <span className="th-hint">target: {inputConfig.cpd?.target}/day</span></th>
                            <th>GCR <span className="th-hint th-hint-stack"><span>Voice: ${inputConfig.gcrVoice?.target}/day</span><span>Msg: ${inputConfig.gcrMessaging?.target}/day</span></span></th>
                            <th>QA <span className="th-hint">target: {inputConfig.qa?.target}%</span></th>
                            <th>Accountable Days</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {inputGuides.map((g, i) => {
                            const days = parseFloat(g.days)
                            const computedCPD = g.cpdMode === 'total' && g.cpd && days > 0 ? (parseFloat(g.cpd) / days).toFixed(2) : null
                            const computedGCR = g.gcrMode === 'total' && g.gcr && days > 0 ? (parseFloat(g.gcr) / days).toFixed(2) : null
                            return (
                              <tr key={i}>
                                <td>
                                  <div className="cell-col">
                                    <div className="cell-header" />
                                    <input value={g.name} onChange={e => handleGuideChange(i, 'name', e.target.value)} placeholder="Name" />
                                  </div>
                                </td>
                                <td>
                                  <div className="cell-col">
                                    <div className="cell-header" />
                                    <input type="email" value={g.email || ''} onChange={e => handleGuideChange(i, 'email', e.target.value)} placeholder="email@example.com" required />
                                  </div>
                                </td>
                                <td>
                                  <div className="cell-col">
                                    <div className="cell-header" />
                                    <select value={g.channel || 'voice'} onChange={e => handleGuideChange(i, 'channel', e.target.value)} className="channel-select">
                                      <option value="voice">Voice</option>
                                      <option value="messaging">Messaging</option>
                                    </select>
                                  </div>
                                </td>
                                <td>
                                  <div className="cell-col">
                                    <div className="cell-header">
                                      <button type="button" className={`mini-toggle ${g.cpdMode === 'perday' ? 'active' : ''}`} onClick={() => toggleMetricMode(i, 'cpd')}>day</button>
                                      <button type="button" className={`mini-toggle ${g.cpdMode === 'total' ? 'active' : ''}`} onClick={() => toggleMetricMode(i, 'cpd')}>total</button>
                                    </div>
                                    <input type="number" value={g.cpd} onChange={e => handleGuideChange(i, 'cpd', e.target.value)} placeholder={g.cpdMode === 'total' ? 'Total contacts' : 'Per day'} step="0.01" />
                                    {computedCPD && <span className="computed-hint">{computedCPD}/day</span>}
                                  </div>
                                </td>
                                <td>
                                  <div className="cell-col">
                                    <div className="cell-header">
                                      <button type="button" className={`mini-toggle ${g.gcrMode === 'perday' ? 'active' : ''}`} onClick={() => toggleMetricMode(i, 'gcr')}>day</button>
                                      <button type="button" className={`mini-toggle ${g.gcrMode === 'total' ? 'active' : ''}`} onClick={() => toggleMetricMode(i, 'gcr')}>total</button>
                                    </div>
                                    <input type="number" value={g.gcr} onChange={e => handleGuideChange(i, 'gcr', e.target.value)} placeholder={g.gcrMode === 'total' ? 'Total GCR ($)' : 'Per day ($)'} step="0.01" />
                                    {computedGCR && <span className="computed-hint">${computedGCR}/day</span>}
                                  </div>
                                </td>
                                <td>
                                  <div className="cell-col">
                                    <div className="cell-header" />
                                    <input type="number" value={g.qa} onChange={e => handleGuideChange(i, 'qa', e.target.value)} placeholder="QA %" step="0.01" min="0" max="100" />
                                  </div>
                                </td>
                                <td>
                                  <div className="cell-col">
                                    <div className="cell-header" />
                                    <input type="number" value={g.days} onChange={e => handleGuideChange(i, 'days', e.target.value)} placeholder="# days" min="0.1" step="0.1" />
                                  </div>
                                </td>
                                <td>
                                  <div className="cell-col">
                                    <div className="cell-header" />
                                    <button type="button" className="btn-remove" onClick={() => handleRemoveGuide(i)}>✕</button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="bulk-actions">
                      <button type="button" className="btn-secondary" onClick={() => { setInputGuides([...inputGuides, { ...EMPTY_GUIDE }]); setInputResults(null) }}>+ Add Guide</button>
                      {isCurrentMonth ? (
                        <button type="button" className="btn-primary" onClick={handleCalculate}>Calculate All</button>
                      ) : (
                        <button type="button" className="btn-primary" onClick={handleSaveMonth}>Save &amp; Recalculate</button>
                      )}
                      {isCurrentMonth && (
                        <div className="bulk-actions-right">
                          <button type="button" className="btn-close-month" onClick={handleCloseMonth}>
                            Close {config.month}
                          </button>
                          {closeMonthMsg && <span className="close-month-msg">{closeMonthMsg}</span>}
                        </div>
                      )}
                      {!isCurrentMonth && editingGuides && (
                        <button type="button" className="btn-ghost" onClick={() => { setEditingGuides(false); loadInputMonth(inputMonth) }}>Cancel</button>
                      )}
                      {saveMonthMsg && <span className="close-month-msg">{saveMonthMsg}</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <button className="btn-secondary" onClick={() => { setEditingGuides(true); setInputResults(null) }}>Edit Month</button>
                    </div>
                    {inputResults?.length > 0 ? (
                      <table className="score-table">
                        <thead>
                          <tr><th>Name</th><th>Channel</th><th>CPD</th><th>GCR</th><th>QA</th><th>Total MIS</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {inputResults.map((r, i) => r ? (
                            <tr key={i}>
                              <td>{r.name}</td>
                              <td>{r.channel === 'messaging' ? 'Messaging' : 'Voice'}</td>
                              <td><div className="result-metric-cell"><span className="result-actual">{r.actuals.cpd.toFixed(2)}/day</span><span className="result-points" style={{ color: scoreColor(r.cpd) }}>{fmtSigned(r.cpd)} pts</span></div></td>
                              <td><div className="result-metric-cell"><span className="result-actual">${r.actuals.gcr.toFixed(2)}/day</span><span className="result-points" style={{ color: scoreColor(r.gcr) }}>{fmtSigned(r.gcr)} pts</span></div></td>
                              <td><div className="result-metric-cell"><span className="result-actual">{r.actuals.qa.toFixed(1)}%</span><span className="result-points" style={{ color: scoreColor(r.qa) }}>{fmtSigned(r.qa)} pts</span></div></td>
                              <td style={{ color: scoreColor(r.total), fontWeight: 'bold' }}>{fmtSigned(r.total)}</td>
                              <td><span className={`pass-badge small ${r.passing ? 'pass' : 'fail'}`}>{r.passing ? 'On Track' : 'Off Track'}</span></td>
                            </tr>
                          ) : null)}
                        </tbody>
                      </table>
                    ) : (
                      <p className="subtext">No results recorded. Click "Edit Month" to add data.</p>
                    )}
                  </>
                )}

                {isCurrentMonth && inputResults && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <table className="score-table">
                      <thead>
                        <tr><th>Name</th><th>CPD</th><th>GCR</th><th>QA</th><th>Total MIS</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {inputResults.map((r, i) => r ? (
                          <tr key={i}>
                            <td>{r.name}</td>
                            <td><div className="result-metric-cell"><span className="result-actual">{r.actuals.cpd.toFixed(2)}/day</span><span className="result-points" style={{ color: scoreColor(r.cpd) }}>{fmtSigned(r.cpd)} pts</span></div></td>
                            <td><div className="result-metric-cell"><span className="result-actual">${r.actuals.gcr.toFixed(2)}/day</span><span className="result-points" style={{ color: scoreColor(r.gcr) }}>{fmtSigned(r.gcr)} pts</span></div></td>
                            <td><div className="result-metric-cell"><span className="result-actual">{r.actuals.qa.toFixed(1)}%</span><span className="result-points" style={{ color: scoreColor(r.qa) }}>{fmtSigned(r.qa)} pts</span></div></td>
                            <td style={{ color: scoreColor(r.total), fontWeight: 'bold' }}>{fmtSigned(r.total)}</td>
                            <td><span className={`pass-badge small ${r.passing ? 'pass' : 'fail'}`}>{r.passing ? 'On Track' : 'Off Track'}</span></td>
                          </tr>
                        ) : <tr key={i}><td colSpan={6} className="invalid-row">Incomplete data for row {i + 1}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TEAM TREND TAB ── */}
      {tab === 'team-trend' && (
        <div className="trend-tab">
          {!archivedMonths?.length ? (
            <p className="subtext">No archived months yet. Close a month first to see trends.</p>
          ) : !allArchiveData ? (
            <p className="subtext">Loading…</p>
          ) : teamTrendRows.length === 0 ? (
            <p className="subtext">No team averages found. Averages are computed when a month is closed.</p>
          ) : (() => {
            const ttCpdVals = teamTrendRows.map(r => r.cpd)
            const ttGcrVals = teamTrendRows.map(r => r.gcr)
            const ttQaVals  = teamTrendRows.map(r => r.qa)
            const ttCpdPts  = teamTrendRows.map(r => r.cpdPts)
            const ttGcrPts  = teamTrendRows.map(r => r.gcrPts)
            const ttQaPts   = teamTrendRows.map(r => r.qaPts)
            const ttMisVals = teamTrendRows.map(r => r.total)
            return (
              <>
                <div className="trend-cards">
                  {[
                    { label: 'Avg CPD',       sparkVals: ttCpdPts, dispVals: ttCpdVals, ptsVals: ttCpdPts, color: '#3b82f6', fmt: v => `${v.toFixed(2)}/day`,  dFmt: v => v.toFixed(2) },
                    { label: 'Avg GCR',       sparkVals: ttGcrPts, dispVals: ttGcrVals, ptsVals: ttGcrPts, color: '#22c55e', fmt: v => `$${v.toFixed(2)}/day`, dFmt: v => `$${v.toFixed(2)}` },
                    { label: 'Avg QA',        sparkVals: ttQaPts,  dispVals: ttQaVals,  ptsVals: ttQaPts,  color: '#f59e0b', fmt: v => `${v.toFixed(1)}%`,     dFmt: v => `${v.toFixed(1)}%` },
                    { label: 'Avg Total MIS', sparkVals: ttMisVals, dispVals: ttMisVals, ptsVals: null,    color: scoreColor(ttMisVals[ttMisVals.length - 1]), fmt: v => fmtSigned(v), dFmt: v => fmtSigned(v) },
                  ].map(({ label, sparkVals, dispVals, ptsVals, color, fmt, dFmt }) => {
                    const d    = trendDelta(dispVals)
                    const dPts = ptsVals ? trendDelta(ptsVals) : null
                    return (
                      <div key={label} className="trend-card">
                        <span className="trend-card-label">{label}</span>
                        <Sparkline values={sparkVals} color={color} />
                        <div className="trend-card-footer">
                          <span className="trend-card-latest" style={{ color }}>{fmt(dispVals[dispVals.length - 1])}</span>
                          {d != null && (
                            <span className="trend-delta" style={{ color: d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#f59e0b' }}>
                              {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {dFmt(Math.abs(d))}
                            </span>
                          )}
                        </div>
                        {ptsVals && (
                          <div className="trend-card-pts">
                            <span className="trend-card-pts-val" style={{ color: scoreColor(ptsVals[ptsVals.length - 1]) }}>
                              {fmtSigned(ptsVals[ptsVals.length - 1])} pts
                            </span>
                            {dPts != null && (
                              <span className="trend-delta" style={{ color: dPts > 0 ? '#22c55e' : dPts < 0 ? '#ef4444' : '#f59e0b' }}>
                                {dPts > 0 ? '↑' : dPts < 0 ? '↓' : '→'} {parseFloat(Math.abs(dPts).toFixed(2))} pts
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <table className="score-table">
                  <thead>
                    <tr><th>Month</th><th>Guides</th><th>Avg CPD</th><th>Avg GCR</th><th>Avg QA</th><th>Avg MIS</th><th>Pass Rate</th></tr>
                  </thead>
                  <tbody>
                    {teamTrendRows.map(r => (
                      <tr key={r.month}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtMonth(r.month)}</td>
                        <td>{r.count}</td>
                        <td><div className="result-metric-cell"><span className="result-actual">{r.cpd.toFixed(2)}/day</span><span className="result-points" style={{ color: scoreColor(r.cpdPts) }}>{fmtSigned(r.cpdPts)} pts</span></div></td>
                        <td><div className="result-metric-cell"><span className="result-actual">${r.gcr.toFixed(2)}/day</span><span className="result-points" style={{ color: scoreColor(r.gcrPts) }}>{fmtSigned(r.gcrPts)} pts</span></div></td>
                        <td><div className="result-metric-cell"><span className="result-actual">{r.qa.toFixed(1)}%</span><span className="result-points" style={{ color: scoreColor(r.qaPts) }}>{fmtSigned(r.qaPts)} pts</span></div></td>
                        <td style={{ color: scoreColor(r.total), fontWeight: 'bold' }}>{fmtSigned(r.total)}</td>
                        <td><span className={`pass-badge small ${r.passRate >= 0.5 ? 'pass' : 'fail'}`}>{Math.round(r.passRate * r.count)}/{r.count} ({Math.round(r.passRate * 100)}%)</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )
          })()}
        </div>
      )}

      {/* ── GUIDE TREND TAB ── */}
      {tab === 'trend' && (
        <div className="trend-tab">
          {!archivedMonths?.length ? (
            <p className="subtext">No archived months yet. Close a month first to see trends.</p>
          ) : (
            <>
              <div className="trend-guide-select">
                <span className="trend-label">Select guide</span>
                <select value={trendGuide} onChange={e => setTrendGuide(e.target.value)} disabled={!allArchiveData}>
                  <option value="">— choose —</option>
                  {allGuideNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {!allArchiveData && <span className="subtext">Loading…</span>}
              </div>

              {trendGuide && trendRows.length === 0 && (
                <p className="subtext">No archived data found for {trendGuide}.</p>
              )}

              {trendRows.length > 0 && (
                <>
                  <div className="trend-cards">
                    {[
                      { label: 'CPD',       sparkVals: cpdPts, dispVals: cpdVals, ptsVals: cpdPts, color: '#3b82f6', fmt: v => `${v.toFixed(2)}/day`, dFmt: v => v.toFixed(2) },
                      { label: 'GCR',       sparkVals: gcrPts, dispVals: gcrVals, ptsVals: gcrPts, color: '#22c55e', fmt: v => `$${v.toFixed(2)}/day`, dFmt: v => `$${v.toFixed(2)}` },
                      { label: 'QA',        sparkVals: qaPts,  dispVals: qaVals,  ptsVals: qaPts,  color: '#f59e0b', fmt: v => `${v.toFixed(1)}%`, dFmt: v => `${v.toFixed(1)}%` },
                      { label: 'Total MIS', sparkVals: misVals, dispVals: misVals, ptsVals: null,  color: scoreColor(misVals[misVals.length - 1]), fmt: v => fmtSigned(v), dFmt: v => fmtSigned(v) },
                    ].map(({ label, sparkVals, dispVals, ptsVals, color, fmt, dFmt }) => {
                      const d    = trendDelta(dispVals)
                      const dPts = ptsVals ? trendDelta(ptsVals) : null
                      return (
                        <div key={label} className="trend-card">
                          <span className="trend-card-label">{label}</span>
                          <Sparkline values={sparkVals} color={color} />
                          <div className="trend-card-footer">
                            <span className="trend-card-latest" style={{ color }}>{fmt(dispVals[dispVals.length - 1])}</span>
                            {d != null && (
                              <span className="trend-delta" style={{ color: d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#f59e0b' }}>
                                {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {dFmt(Math.abs(d))}
                              </span>
                            )}
                          </div>
                          {ptsVals && (
                            <div className="trend-card-pts">
                              <span className="trend-card-pts-val" style={{ color: scoreColor(ptsVals[ptsVals.length - 1]) }}>
                                {fmtSigned(ptsVals[ptsVals.length - 1])} pts
                              </span>
                              {dPts != null && (
                                <span className="trend-delta" style={{ color: dPts > 0 ? '#22c55e' : dPts < 0 ? '#ef4444' : '#f59e0b' }}>
                                  {dPts > 0 ? '↑' : dPts < 0 ? '↓' : '→'} {parseFloat(Math.abs(dPts).toFixed(2))} pts
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <table className="score-table">
                    <thead>
                      <tr><th>Month</th><th>CPD</th><th>GCR</th><th>QA</th><th>Total MIS</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {trendRows.map(r => (
                        <tr key={r.month}>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtMonth(r.month)}</td>
                          <td><div className="result-metric-cell"><span className="result-actual">{r.actuals.cpd.toFixed(2)}/day</span><span className="result-points" style={{ color: scoreColor(r.cpd) }}>{fmtSigned(r.cpd)} pts</span></div></td>
                          <td><div className="result-metric-cell"><span className="result-actual">${r.actuals.gcr.toFixed(2)}/day</span><span className="result-points" style={{ color: scoreColor(r.gcr) }}>{fmtSigned(r.gcr)} pts</span></div></td>
                          <td><div className="result-metric-cell"><span className="result-actual">{r.actuals.qa.toFixed(1)}%</span><span className="result-points" style={{ color: scoreColor(r.qa) }}>{fmtSigned(r.qa)} pts</span></div></td>
                          <td style={{ color: scoreColor(r.total), fontWeight: 'bold' }}>{fmtSigned(r.total)}</td>
                          <td><span className={`pass-badge small ${r.passing ? 'pass' : 'fail'}`}>{r.passing ? 'On Track' : 'Off Track'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
