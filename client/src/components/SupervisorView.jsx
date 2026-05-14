import { useState, useEffect, useRef, useMemo } from 'react'
import { calculateMIS } from '../utils/misCalculator'
import {
  getTeam, saveTeam, deleteGuideRow, clearMonthData,
  getArchivedMonths, getArchivedMonth,
  saveConfig,
  getSupervisorUsernames, addSupervisorUser, removeSupervisorUser, changeSupervisorPassword,
  getGuides, getGuidesWithHistory, addGuide, updateGuide, deleteGuide, resetGuidePassword,
  getQaReviews, addQaReview, updateQaReview, deleteQaReview,
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
  const [inputSaveStatus, setInputSaveStatus] = useState(null)
  const [inputLoading, setInputLoading] = useState(false)
  const [editingInputConfig, setEditingInputConfig] = useState(false)
  const [inputConfigDraft, setInputConfigDraft] = useState({ ...config })
  const [inputConfigMsg, setInputConfigMsg] = useState('')
  const [rosterPickMonth, setRosterPickMonth] = useState('')
  const [showRosterPicker, setShowRosterPicker] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [inputQaAverages, setInputQaAverages] = useState({})

  // userEdited ref: only set true by actual user edits, not by data loads.
  // This prevents auto-save from firing immediately after loading month data.
  const userEdited = useRef(false)

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

  // Manage Team tab
  const [teamGuides, setTeamGuides] = useState(null)
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState('')
  const [editingGuideName, setEditingGuideName] = useState(null)
  const [editDraft, setEditDraft] = useState({})
  const [editGuideMsg, setEditGuideMsg] = useState(null)
  const [addGuideName, setAddGuideName] = useState('')
  const [addGuideChannel, setAddGuideChannel] = useState('voice')
  const [addGuideMsg, setAddGuideMsg] = useState(null)

  // QA Reviews tab
  const [qaMonth, setQaMonth] = useState(config.month)
  const [qaReviews, setQaReviews] = useState([])
  const [qaLoading, setQaLoading] = useState(false)
  const [qaError, setQaError] = useState('')
  const [qaGuideName, setQaGuideName] = useState('')
  const [qaScore, setQaScore] = useState('')
  const [qaDate, setQaDate] = useState(new Date().toISOString().slice(0, 10))
  const [qaAddMsg, setQaAddMsg] = useState('')
  const [qaGuideNames, setQaGuideNames] = useState([])
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editReviewScore, setEditReviewScore] = useState('')
  const [editReviewDate, setEditReviewDate] = useState('')

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

  const inputResults = calcResults(inputGuides, inputConfig)

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

  // Trend data: only load for months that are not the current config month
  useEffect(() => {
    if ((tab !== 'trend' && tab !== 'team-trend') || allArchiveData !== null || !archivedMonths?.length) return
    const trendMonths = archivedMonths.filter(m => m !== config.month)
    if (!trendMonths.length) { setAllArchiveData({}); return }
    let cancelled = false
    ;(async () => {
      const map = {}
      for (const m of trendMonths) {
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
    userEdited.current = false
    setShowResetConfirm(false)
    setInputConfigMsg('')
    setEditingInputConfig(false)
    setShowRosterPicker(false)

    try {
      const data = await getTeam(month)
      const namedGuides = data.guides?.filter(g => g.name)
      if (namedGuides?.length > 0) {
        setInputGuides(data.guides)
      } else {
        setInputGuides([{ ...EMPTY_GUIDE }])
        if (month === config.month) setShowRosterPicker(true)
      }
      if (month === config.month) {
        setInputConfig({ ...config })
        setInputConfigDraft({ ...config })
      } else {
        const archiveData = await getArchivedMonth(month)
        const cfg = archiveData?.config ?? config
        setInputConfig({ ...cfg })
        setInputConfigDraft({ ...cfg })
        if (archiveData?.results?.length && namedGuides?.length) {
        }
      }
    } catch (err) {
      console.error('Error loading month:', err)
      setInputGuides([{ ...EMPTY_GUIDE }])
    }

    setInputLoading(false)
    // Delay enabling auto-save until after this render's effects have run,
    // so the setInputGuides above does not trigger an immediate save.
    setTimeout(() => { userEdited.current = false }, 0)
  }

  useEffect(() => { loadInputMonth(inputMonth) }, [inputMonth])

  useEffect(() => {
    getQaReviews(inputMonth).then(reviews => {
      const map = {}
      reviews.forEach(r => {
        if (!map[r.guide_name]) map[r.guide_name] = { sum: 0, count: 0 }
        map[r.guide_name].sum += Number(r.score)
        map[r.guide_name].count += 1
      })
      const avgs = {}
      Object.entries(map).forEach(([name, { sum, count }]) => {
        avgs[name] = Math.round(sum / count * 100) / 100
      })
      setInputQaAverages(avgs)
    }).catch(() => {})
  }, [inputMonth])

  // Debounced auto-save for all months
  useEffect(() => {
    if (!userEdited.current) return
    setInputSaveStatus('saving')
    const timer = setTimeout(async () => {
      try {
        const updated = await saveTeam(inputMonth, inputGuides)
        if (updated !== inputGuides) {
          userEdited.current = false
          setInputGuides(updated)
          // userEdited stays false so the setInputGuides above won't re-trigger save
        }
        setInputSaveStatus('saved')
        fetchArchivedMonths()
      } catch {
        setInputSaveStatus('error')
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [inputGuides])

  const markEdited = () => { userEdited.current = true }

  const handleGuideChange = (i, field, value) => {
    markEdited()
    setInputGuides(inputGuides.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
  }

  const toggleMetricMode = (i, metric) => {
    markEdited()
    setInputGuides(inputGuides.map((g, idx) => idx === i
      ? { ...g, [`${metric}Mode`]: g[`${metric}Mode`] === 'perday' ? 'total' : 'perday', [metric]: '' }
      : g))
  }

  const handleResetMonth = async () => {
    setShowResetConfirm(false)
    userEdited.current = false
    try {
      await clearMonthData(inputMonth)
      await loadInputMonth(inputMonth)
      fetchArchivedMonths()
    } catch { /* ignore */ }
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
        await saveConfig({ ...inputConfigDraft, month: inputMonth })
        setInputConfig({ ...inputConfigDraft })
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
      const namedGuides = data.guides.filter(g => g.name)
      if (!namedGuides.length) return
      markEdited()
      setInputGuides(namedGuides.map(g => ({ ...EMPTY_GUIDE, name: g.name, email: g.email || '', channel: g.channel || 'voice' })))
      setShowRosterPicker(false)
    } catch { /* ignore */ }
  }

  const handleRemoveGuide = (i) => {
    if (inputGuides.length === 1) return
    const guide = inputGuides[i]
    markEdited()
    setInputGuides(inputGuides.filter((_, idx) => idx !== i))
    if (guide.id) deleteGuideRow(guide.id).catch(() => {})
  }

  const handleLoadActiveGuides = async () => {
    try {
      const guides = await getGuides()
      const active = guides.filter(g => g.active)
      if (!active.length) return
      markEdited()
      setInputGuides(active.map(g => ({ ...EMPTY_GUIDE, name: g.name, email: g.email || '', channel: g.channel || 'voice' })))
      setShowRosterPicker(false)
    } catch { /* ignore */ }
  }

  // Manage Team handlers
  const loadTeamGuides = async () => {
    setTeamLoading(true)
    setTeamError('')
    try {
      const guides = await getGuidesWithHistory()
      setTeamGuides(guides)
    } catch (err) {
      setTeamError(err.message)
    }
    setTeamLoading(false)
  }

  useEffect(() => {
    if (tab === 'manage-team' && teamGuides === null) loadTeamGuides()
  }, [tab])

  useEffect(() => {
    if (tab !== 'qa') return
    let cancelled = false
    setQaLoading(true); setQaError('')
    getQaReviews(qaMonth)
      .then(data => { if (!cancelled) { setQaReviews(data); setQaLoading(false) } })
      .catch(err => { if (!cancelled) { setQaError(err.message); setQaLoading(false) } })
    getGuides()
      .then(guides => { if (!cancelled) setQaGuideNames(guides.filter(g => g.active).map(g => g.name)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tab, qaMonth])

  const handleAddGuide = async (e) => {
    e.preventDefault()
    setAddGuideMsg(null)
    const trimmed = addGuideName.trim()
    try {
      await addGuide({ name: trimmed, channel: addGuideChannel })
      setAddGuideName('')
      setAddGuideChannel('voice')
      setAddGuideMsg({ ok: true, text: `${trimmed} added.` })
      setTimeout(() => setAddGuideMsg(null), 3000)
      await loadTeamGuides()
    } catch (err) {
      setAddGuideMsg({ ok: false, text: err.message })
    }
  }

  const handleSaveEditGuide = async (guide) => {
    setEditGuideMsg(null)
    try {
      await updateGuide(guide.name, editDraft)
      setEditingGuideName(null)
      setEditDraft({})
      await loadTeamGuides()
    } catch (err) {
      setEditGuideMsg({ ok: false, text: err.message })
    }
  }

  const handleToggleActive = async (guide) => {
    try {
      await updateGuide(guide.name, { active: !guide.active })
      await loadTeamGuides()
    } catch (err) {
      setTeamError(err.message)
    }
  }

  const handleDeleteGuide = async (guide) => {
    setTeamError('')
    try {
      await deleteGuide(guide.name)
      await loadTeamGuides()
    } catch (err) {
      setTeamError(err.message)
    }
  }

  const handleResetGuidePassword = async (guide) => {
    try {
      await resetGuidePassword(guide.name)
      setTeamError('')
    } catch (err) {
      setTeamError(err.message)
    }
  }

  const handleAddQaReview = async () => {
    const score = parseFloat(qaScore)
    if (!qaGuideName) return setQaAddMsg('Select a guide.')
    if (isNaN(score) || score < 0 || score > 100) return setQaAddMsg('Score must be 0–100.')
    if (!qaDate) return setQaAddMsg('Select a date.')
    setQaAddMsg('')
    try {
      await addQaReview({ guideName: qaGuideName, score, reviewDate: qaDate })
      setQaScore('')
      setQaReviews(await getQaReviews(qaMonth))
    } catch (err) { setQaAddMsg(err.message) }
  }

  const handleDeleteQaReview = async (review) => {
    try {
      await deleteQaReview(review.id, review.guide_name, review.month)
      setQaReviews(await getQaReviews(qaMonth))
    } catch (err) { setQaError(err.message) }
  }

  const handleSaveEditReview = async (review) => {
    const score = parseFloat(editReviewScore)
    if (isNaN(score) || score < 0 || score > 100) return
    try {
      await updateQaReview(review.id, review.guide_name, review.month, { score, reviewDate: editReviewDate })
      setEditingReviewId(null)
      setQaReviews(await getQaReviews(qaMonth))
    } catch (err) { setQaError(err.message) }
  }

  // Trend derived values — only use months that are not the current config month
  const trendMonths = Object.keys(allArchiveData || {}).filter(m => m !== config.month)

  const allGuideNames = allArchiveData
    ? [...new Set(trendMonths.flatMap(m => (allArchiveData[m]?.results || []).filter(Boolean).map(r => r.name)))].sort()
    : []

  const trendRows = trendGuide && allArchiveData
    ? trendMonths
        .map(month => {
          const result = allArchiveData[month]?.results?.find(r => r?.name === trendGuide)
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
    ? trendMonths
        .filter(m => allArchiveData[m]?.averages)
        .map(m => ({ month: m, ...allArchiveData[m].averages }))
        .sort((a, b) => a.month.localeCompare(b.month))
    : []

  const trendDelta = (arr) => arr.length >= 2 ? arr[arr.length - 1] - arr[arr.length - 2] : null

  const groupedQaReviews = useMemo(() => {
    const map = {}
    qaReviews.forEach(r => { if (!map[r.guide_name]) map[r.guide_name] = []; map[r.guide_name].push(r) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([name, reviews]) => ({
      name, reviews,
      avg: reviews.length
        ? Math.round(reviews.reduce((s, r) => s + Number(r.score), 0) / reviews.length * 100) / 100
        : null,
    }))
  }, [qaReviews])

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
        {[['input', 'Input'], ['qa', 'QA Reviews'], ['team-trend', 'Team Trend'], ['trend', 'Guide Trend'], ['manage-team', 'Manage Team']].map(([t, label]) => (
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
                    {fmtMonth(m)}{m === config.month ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {inputLoading && <p className="subtext">Loading…</p>}

          {!inputLoading && (
            <>
              {/* Config section */}
              <div className="history-section">
                <div className="history-section-header">
                  <h4>Targets — {fmtMonth(inputMonth)}</h4>
                  {!editingInputConfig && (
                    <button className="btn-ghost" onClick={() => { setEditingInputConfig(true); setInputConfigDraft({ ...inputConfig }); setInputConfigMsg('') }}>
                      Set Targets
                    </button>
                  )}
                </div>
                {editingInputConfig ? (
                  <form onSubmit={handleSaveInputConfig}>
                    {isCurrentMonth && (
                      <div className="targets-month-row">
                        <span className="targets-month-label">Month</span>
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
                    <table className="targets-table">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Min</th>
                          <th>Target</th>
                          <th>Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CONFIG_METRICS.map(({ key, label }) => (
                          <tr key={key}>
                            <td className="targets-metric-name">{label}</td>
                            {['min', 'target', 'max'].map(field => (
                              <td key={field}>
                                <input
                                  type="number"
                                  className="targets-input"
                                  value={inputConfigDraft[key]?.[field] ?? ''}
                                  onChange={e => setInputConfigDraft({
                                    ...inputConfigDraft,
                                    [key]: { ...inputConfigDraft[key], [field]: parseFloat(e.target.value) || e.target.value }
                                  })}
                                  step="0.01"
                                  required
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="targets-form-actions">
                      <button type="submit" className="btn-primary">Save</button>
                      <button type="button" className="btn-ghost" onClick={() => { setEditingInputConfig(false); setInputConfigDraft({ ...inputConfig }); setInputConfigMsg('') }}>Cancel</button>
                      {inputConfigMsg && <span className="close-month-msg">{inputConfigMsg}</span>}
                    </div>
                  </form>
                ) : (
                  <table className="targets-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Min</th>
                        <th>Target</th>
                        <th>Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CONFIG_METRICS.map(({ key, label, prefix, suffix }) => {
                        const c = inputConfig[key]
                        if (!c) return null
                        return (
                          <tr key={key}>
                            <td className="targets-metric-name">{label}</td>
                            <td className="targets-val">{prefix}{c.min}{suffix}</td>
                            <td className="targets-val targets-val-target">{prefix}{c.target}{suffix}</td>
                            <td className="targets-val">{prefix}{c.max}{suffix}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Roster picker (when month has no named guides yet) */}
              {showRosterPicker && (
                <div className="new-month-banner">
                  <span>Start this month with…</span>
                  <div className="new-month-controls">
                    <button type="button" className="btn-secondary" onClick={handleLoadActiveGuides}>
                      Active Guides
                    </button>
                    {(archivedMonths || []).filter(m => m !== config.month).length > 0 && (
                      <>
                        <span className="cfg-sep">or import from</span>
                        <select
                          value={rosterPickMonth}
                          onChange={e => setRosterPickMonth(e.target.value)}
                        >
                          <option value="">— previous month —</option>
                          {(archivedMonths || []).filter(m => m !== config.month).map(m => (
                            <option key={m} value={m}>{fmtMonth(m)}</option>
                          ))}
                        </select>
                        <button type="button" className="btn-secondary" disabled={!rosterPickMonth} onClick={() => handleLoadRoster(rosterPickMonth)}>
                          Import Names
                        </button>
                      </>
                    )}
                    <button type="button" className="btn-ghost" onClick={() => setShowRosterPicker(false)}>
                      Start Fresh
                    </button>
                  </div>
                </div>
              )}

              {/* Team averages (for months with results) */}
              {!isCurrentMonth && inputResults.some(Boolean) && (() => {
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
                    {isCurrentMonth ? `${fmtMonth(inputMonth)} — In Progress` : `${fmtMonth(inputMonth)}`}
                  </h3>
                  {inputSaveStatus && (
                    <span className={`save-status ${inputSaveStatus}`}>
                      {inputSaveStatus === 'saving' ? 'Saving…' : inputSaveStatus === 'saved' ? 'Saved' : 'Save failed'}
                    </span>
                  )}
                </div>

                <div className="bulk-table-wrap">
                  <table className="bulk-input-table">
                    <thead>
                      <tr>
                        <th>Guide Name</th>
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
                                {(() => {
                                  const avg = inputQaAverages[g.name]
                                  if (avg == null) return null
                                  const typed = parseFloat(g.qa)
                                  if (isNaN(typed) || Math.abs(typed - avg) < 0.005) return null
                                  return <span className="qa-mismatch-hint" title={`Review average is ${avg}`}>⚠ avg {avg}</span>
                                })()}
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
                  <div className="bulk-actions-right">
                    {showResetConfirm ? (
                      <span className="reset-confirm-inline">
                        <span className="reset-confirm-label">Reset {fmtMonth(inputMonth)}?</span>
                        <button type="button" className="btn-danger-sm" onClick={handleResetMonth}>Yes, Reset</button>
                        <button type="button" className="btn-ghost" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                      </span>
                    ) : (
                      <button type="button" className="btn-ghost" onClick={() => setShowResetConfirm(true)}>Reset Month</button>
                    )}
                  </div>
                </div>

                {inputResults.some(Boolean) && (
                  <div style={{ marginTop: '1.5rem' }}>
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
                        ) : <tr key={i}><td colSpan={7} className="invalid-row">Incomplete data for row {i + 1}</td></tr>)}
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
            <p className="subtext">No data yet. Add and save guide scores to see trends.</p>
          ) : !allArchiveData ? (
            <p className="subtext">Loading…</p>
          ) : teamTrendRows.length === 0 ? (
            <p className="subtext">No completed months to show trends for yet.</p>
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

      {/* ── MANAGE TEAM TAB ── */}
      {tab === 'manage-team' && (
        <div className="manage-team-tab">
          {teamLoading && <p className="subtext">Loading…</p>}
          {teamError && <p className="manage-team-error">{teamError}</p>}

          {!teamLoading && teamGuides !== null && (
            <>
              <div className="manage-team-table-wrap">
                <table className="manage-team-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Default Channel <span className="th-hint">per-month override in Input tab</span></th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamGuides.length === 0 && (
                      <tr><td colSpan={4} className="invalid-row">No guides on the team yet.</td></tr>
                    )}
                    {teamGuides.map(guide => (
                      <tr key={guide.name} className={guide.active ? '' : 'guide-inactive-row'}>
                        {editingGuideName === guide.name ? (
                          <>
                            <td><span className="guide-name-cell">{guide.name}</span></td>
                            <td>
                              <select
                                value={editDraft.channel ?? guide.channel}
                                onChange={e => setEditDraft({ ...editDraft, channel: e.target.value })}
                              >
                                <option value="voice">Voice</option>
                                <option value="messaging">Messaging</option>
                              </select>
                            </td>
                            <td>
                              <span className={`guide-status-badge ${guide.active ? 'active' : 'inactive'}`}>
                                {guide.active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="manage-guide-actions">
                                <button className="btn-primary btn-sm" onClick={() => handleSaveEditGuide(guide)}>Save</button>
                                <button className="btn-ghost btn-sm" onClick={() => { setEditingGuideName(null); setEditDraft({}); setEditGuideMsg(null) }}>Cancel</button>
                                {editGuideMsg && <span className={editGuideMsg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>{editGuideMsg.text}</span>}
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td><span className="guide-name-cell">{guide.name}</span></td>
                            <td>{guide.channel === 'messaging' ? 'Messaging' : 'Voice'}</td>
                            <td>
                              <span className={`guide-status-badge ${guide.active ? 'active' : 'inactive'}`}>
                                {guide.active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="manage-guide-actions">
                                <button
                                  className="btn-ghost btn-sm"
                                  onClick={() => { setEditingGuideName(guide.name); setEditDraft({ channel: guide.channel }); setEditGuideMsg(null) }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn-ghost btn-sm"
                                  onClick={() => handleToggleActive(guide)}
                                >
                                  {guide.active ? 'Deactivate' : 'Reactivate'}
                                </button>
                                <button
                                  className="btn-ghost btn-sm"
                                  onClick={() => handleResetGuidePassword(guide)}
                                  title="Reset password to 'changeme'"
                                >
                                  Reset PW
                                </button>
                                {!guide.hasHistory && (
                                  <button
                                    className="btn-danger-sm"
                                    onClick={() => handleDeleteGuide(guide)}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="manage-team-add">
                <h4>Add Guide</h4>
                <form onSubmit={handleAddGuide} className="manage-add-form">
                  <input
                    type="text"
                    placeholder="Guide name"
                    value={addGuideName}
                    onChange={e => setAddGuideName(e.target.value)}
                    required
                  />
                  <select value={addGuideChannel} onChange={e => setAddGuideChannel(e.target.value)}>
                    <option value="voice">Voice</option>
                    <option value="messaging">Messaging</option>
                  </select>
                  <button type="submit" className="btn-primary">Add Guide</button>
                  {addGuideMsg && (
                    <span className={addGuideMsg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>
                      {addGuideMsg.text}
                    </span>
                  )}
                </form>
                <p className="subtext" style={{ marginTop: '0.5rem' }}>
                  New guides are created with the default password "changeme".
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── QA REVIEWS TAB ── */}
      {tab === 'qa' && (
        <div className="qa-tab">
          <div className="month-selects">
            <label>Month</label>
            <select value={qaMonth} onChange={e => setQaMonth(e.target.value)}>
              {allInputMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
          </div>

          <div className="qa-add-form">
            <h3>Add Review</h3>
            <div className="qa-add-row">
              <select value={qaGuideName} onChange={e => setQaGuideName(e.target.value)}>
                <option value="">— Select guide —</option>
                {qaGuideNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input
                type="number" min="0" max="100" placeholder="Score (0–100)"
                value={qaScore} onChange={e => setQaScore(e.target.value)}
              />
              <input type="date" value={qaDate} onChange={e => setQaDate(e.target.value)} />
              <button className="btn-primary" onClick={handleAddQaReview}>Add</button>
            </div>
            {qaAddMsg && <p className="qa-msg-error">{qaAddMsg}</p>}
          </div>

          {qaLoading ? <p className="subtext">Loading…</p>
            : qaError ? <p className="error-msg">{qaError}</p>
            : groupedQaReviews.length === 0 ? <p className="subtext">No reviews for {fmtMonth(qaMonth)}.</p>
            : (
              <div className="qa-guide-list">
                {groupedQaReviews.map(({ name, reviews, avg }) => (
                  <div key={name} className="qa-guide-card">
                    <div className="qa-guide-header">
                      <span className="qa-guide-name">{name}</span>
                      <span className={`qa-count-badge${reviews.length < 4 ? ' qa-warn' : ''}`}>
                        {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                        {reviews.length < 4 && ' — min 4 required'}
                      </span>
                      <span className="qa-avg">Avg: {avg !== null ? avg.toFixed(2) : '—'}</span>
                    </div>
                    <table className="qa-reviews-table">
                      <thead><tr><th>Date</th><th>Score</th><th></th></tr></thead>
                      <tbody>
                        {reviews.map(r => (
                          <tr key={r.id}>
                            {editingReviewId === r.id ? (
                              <>
                                <td><input type="date" className="qa-edit-input" value={editReviewDate} onChange={e => setEditReviewDate(e.target.value)} /></td>
                                <td><input type="number" className="qa-edit-input" min="0" max="100" step="0.01" value={editReviewScore} onChange={e => setEditReviewScore(e.target.value)} /></td>
                                <td className="qa-row-actions">
                                  <button className="btn-sm btn-primary" onClick={() => handleSaveEditReview(r)}>Save</button>
                                  <button className="btn-sm btn-ghost" onClick={() => setEditingReviewId(null)}>Cancel</button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>{r.review_date}</td>
                                <td>{Number(r.score).toFixed(2)}</td>
                                <td className="qa-row-actions">
                                  <button className="btn-sm btn-ghost" onClick={() => { setEditingReviewId(r.id); setEditReviewScore(String(r.score)); setEditReviewDate(r.review_date) }}>Edit</button>
                                  <button className="btn-sm btn-danger" onClick={() => handleDeleteQaReview(r)}>Remove</button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* ── GUIDE TREND TAB ── */}
      {tab === 'trend' && (
        <div className="trend-tab">
          {!archivedMonths?.length ? (
            <p className="subtext">No data yet. Add and save guide scores to see trends.</p>
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
                <p className="subtext">No data found for {trendGuide}.</p>
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
