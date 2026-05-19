import { useState, useEffect, useRef, useMemo } from 'react'
import { calculateMISGeneric } from '../utils/misCalculator'
import { TEAM_DEFS, resolveConfigByKey } from '../utils/teamConfig'
import TechTitans from './TechTitans'
import {
  getTeam, saveTeam, deleteGuideRow, clearMonthData,
  getArchivedMonths, getArchivedMonth,
  getConfig, saveConfig,
  getGuides, getGuidesWithHistory, addGuide, updateGuide, deleteGuide, resetGuidePassword,
  getQaReviews, addQaReview, updateQaReview, deleteQaReview,
} from '../utils/storage'

const SPARKLINE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a78bfa']
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

function fmtActual(def, v) {
  if (def.entryMode === 'perday') return `${def.prefix || ''}${v.toFixed(2)}${def.suffix || ''}`
  return `${def.prefix || ''}${v.toFixed(1)}${def.suffix || ''}`
}

export default function SupervisorView({ team, currentUser }) {
  const teamDef = TEAM_DEFS[team] || TEAM_DEFS.pss
  const { metricDefs } = teamDef

  const hasTamRoles = metricDefs.some(def => def.tamTargets)
  const tamRoleOptions = hasTamRoles
    ? (() => {
        const tierMap = metricDefs.find(def => def.tamTargets)?.tamTierMap
        return tierMap ? Object.keys(tierMap) : ['TAM 1', 'TAM 2', 'TAM 3']
      })()
    : []
  const defaultTamRole = tamRoleOptions[0] ?? 'TAM 1'

  const today = new Date().toISOString().slice(0, 7)

  const EMPTY_GUIDE = useMemo(() => {
    const g = { name: '', email: '', tam_role: defaultTamRole, days: '' }
    if (teamDef.hasChannel) g.channel = 'voice'
    for (const def of metricDefs) {
      g[def.key] = ''
      if (def.entryMode === 'perday') g[`${def.key}Mode`] = 'perday'
    }
    return g
  }, [team])

  const configRows = useMemo(() => teamDef.metricDefs.flatMap(def => {
    if (def.tamTargets) {
      if (def.tamTierMap) {
        return Object.entries(def.tamTierMap).map(([tierLabel, cfgKey]) => ({
          configKey: def.configKey, field: cfgKey,
          label: `${def.label} — ${tierLabel}`, prefix: def.prefix || '', suffix: def.suffix || '',
        }))
      }
      return [
        { configKey: def.configKey, field: 'tam1_2Target', label: `${def.label} — TAM 1 & 2`, prefix: def.prefix || '', suffix: def.suffix || '' },
        { configKey: def.configKey, field: 'tam3Target',   label: `${def.label} — TAM 3`,     prefix: def.prefix || '', suffix: def.suffix || '' },
      ]
    }
    if (def.channelSplit && def.configKeyVoice && def.configKeyMessaging) {
      return [
        { configKey: def.configKeyVoice,     field: 'target', label: `${def.label} (Voice)`,     prefix: def.prefix || '', suffix: def.suffix || '' },
        { configKey: def.configKeyMessaging, field: 'target', label: `${def.label} (Messaging)`, prefix: def.prefix || '', suffix: def.suffix || '' },
      ]
    }
    return [{ configKey: def.configKey, field: 'target', label: def.label, prefix: def.prefix || '', suffix: def.suffix || '' }]
  }), [team])

  const [tab, setTab] = useState('input')

  // Config
  const [inputConfig, setInputConfig] = useState(null)
  const [currentConfigMonth, setCurrentConfigMonth] = useState(today)

  // Input tab
  const [inputMonth, setInputMonth] = useState(today)
  const [inputGuides, setInputGuides] = useState([{ ...EMPTY_GUIDE }])
  const [inputSaveStatus, setInputSaveStatus] = useState(null)
  const [inputLoading, setInputLoading] = useState(false)
  const [editingInputConfig, setEditingInputConfig] = useState(false)
  const [inputConfigDraft, setInputConfigDraft] = useState(null)
  const [inputConfigMsg, setInputConfigMsg] = useState('')
  const [rosterPickMonth, setRosterPickMonth] = useState('')
  const [showRosterPicker, setShowRosterPicker] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [inputQaAverages, setInputQaAverages] = useState({})

  const userEdited = useRef(false)

  // Archive list
  const [archivedMonths, setArchivedMonths] = useState(null)

  // Trend tabs
  const [trendGuide, setTrendGuide] = useState('')
  const [allArchiveData, setAllArchiveData] = useState(null)

  // Manage Team tab
  const [teamGuides, setTeamGuides] = useState(null)
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState('')
  const [editingGuideName, setEditingGuideName] = useState(null)
  const [editDraft, setEditDraft] = useState({})
  const [editGuideMsg, setEditGuideMsg] = useState(null)
  const [addGuideName, setAddGuideName] = useState('')
  const [addGuideChannel, setAddGuideChannel] = useState('voice')
  const [addGuideTamRole, setAddGuideTamRole] = useState(defaultTamRole)
  const [addGuideMsg, setAddGuideMsg] = useState(null)

  // QA Reviews tab
  const [qaMonth, setQaMonth] = useState(today)
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

  const isCurrentMonth = inputMonth === currentConfigMonth

  const allInputMonths = useMemo(() => {
    const set = new Set(archivedMonths || [])
    set.add(currentConfigMonth)
    set.add(addMonths(currentConfigMonth, 1))
    set.add(addMonths(currentConfigMonth, 2))
    set.add(addMonths(currentConfigMonth, 3))
    return [...set].sort().reverse()
  }, [archivedMonths, currentConfigMonth])

  const calcResults = (guides, cfg) => {
    if (!cfg) return guides.map(() => null)
    return guides.map(g => {
      if (!g.name) return null
      const days = parseFloat(g.days)
      const actuals = {}
      for (const def of metricDefs) {
        if (def.entryMode === 'perday') {
          const val = g[`${def.key}Mode`] === 'total' && !isNaN(days) && days > 0
            ? parseFloat(g[def.key]) / days
            : parseFloat(g[def.key])
          if (isNaN(val)) return null
          actuals[def.key] = val
        } else {
          const val = parseFloat(g[def.key])
          if (isNaN(val)) return null
          actuals[def.key] = val
        }
      }
      const channel = teamDef.hasChannel ? (g.channel || 'voice') : 'voice'
      const configByKey = resolveConfigByKey(metricDefs, cfg, channel, g.tam_role || 'TAM 1')
      return { name: g.name, channel, actuals, ...calculateMISGeneric(actuals, configByKey, metricDefs) }
    })
  }

  const inputResults = calcResults(inputGuides, inputConfig)

  const scoreColor = (score) => score > 0 ? '#22c55e' : score === 0 ? '#f59e0b' : '#ef4444'
  const fmtSigned = (v) => { const n = parseFloat(Number(v).toFixed(2)); return (n > 0 ? '+' : '') + n }

  const fetchArchivedMonths = async () => {
    try { setArchivedMonths(await getArchivedMonths(team)) } catch { setArchivedMonths([]) }
  }

  // Load config on mount
  useEffect(() => {
    let cancelled = false
    getConfig(team).then(cfg => {
      if (cancelled) return
      setInputConfig(cfg)
      setInputConfigDraft(cfg)
      setCurrentConfigMonth(cfg.month)
      setInputMonth(cfg.month)
      setQaMonth(cfg.month)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [team])

  useEffect(() => { fetchArchivedMonths() }, [team])

  useEffect(() => { setAllArchiveData(null) }, [archivedMonths])

  useEffect(() => {
    if ((tab !== 'trend' && tab !== 'team-trend') || allArchiveData !== null || !archivedMonths?.length) return
    const trendMonths = archivedMonths.filter(m => m !== currentConfigMonth)
    if (!trendMonths.length) { setAllArchiveData({}); return }
    let cancelled = false
    ;(async () => {
      const map = {}
      for (const m of trendMonths) {
        try {
          const data = await getArchivedMonth(m, team)
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
      const data = await getTeam(month, team)
      const namedGuides = data.guides?.filter(g => g.name)
      if (namedGuides?.length > 0) {
        setInputGuides(data.guides)
      } else {
        setInputGuides([{ ...EMPTY_GUIDE }])
      }
      if (month === currentConfigMonth) setShowRosterPicker(true)
      if (month !== currentConfigMonth) {
        const archiveData = await getArchivedMonth(month, team)
        const cfg = archiveData?.config
        if (cfg) { setInputConfig(cfg); setInputConfigDraft(cfg) }
      }
    } catch (err) {
      console.error('Error loading month:', err)
      setInputGuides([{ ...EMPTY_GUIDE }])
    }
    setInputLoading(false)
    setTimeout(() => { userEdited.current = false }, 0)
  }

  // Only load month data after config is ready (inputMonth initialized from config)
  useEffect(() => {
    if (!inputConfig) return
    loadInputMonth(inputMonth)
  }, [inputMonth])

  useEffect(() => {
    if (!teamDef.hasQaReviews) return
    getQaReviews(inputMonth, team).then(reviews => {
      const map = {}
      reviews.forEach(r => {
        if (!map[r.guide_name]) map[r.guide_name] = { sum: 0, count: 0 }
        map[r.guide_name].sum += Number(r.score)
        map[r.guide_name].count += 1
      })
      const avgs = {}
      Object.entries(map).forEach(([name, { sum, count }]) => { avgs[name] = Math.round(sum / count * 100) / 100 })
      setInputQaAverages(avgs)
    }).catch(() => {})
  }, [inputMonth, team])

  // Debounced auto-save
  useEffect(() => {
    if (!userEdited.current) return
    setInputSaveStatus('saving')
    const timer = setTimeout(async () => {
      try {
        const updated = await saveTeam(inputMonth, team, inputGuides)
        if (updated !== inputGuides) { userEdited.current = false; setInputGuides(updated) }
        setInputSaveStatus('saved')
        fetchArchivedMonths()
      } catch { setInputSaveStatus('error') }
    }, 1000)
    return () => clearTimeout(timer)
  }, [inputGuides])

  const markEdited = () => { userEdited.current = true }

  const handleGuideChange = (i, field, value) => {
    markEdited()
    setInputGuides(inputGuides.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
  }

  const toggleMetricMode = (i, metricKey) => {
    markEdited()
    setInputGuides(inputGuides.map((g, idx) => idx === i
      ? { ...g, [`${metricKey}Mode`]: g[`${metricKey}Mode`] === 'perday' ? 'total' : 'perday', [metricKey]: '' }
      : g))
  }

  const handleResetMonth = async () => {
    setShowResetConfirm(false)
    userEdited.current = false
    try { await clearMonthData(inputMonth, team); await loadInputMonth(inputMonth); fetchArchivedMonths() } catch { /* ignore */ }
  }

  const handleSaveInputConfig = async (e) => {
    e.preventDefault()
    setInputConfigMsg('')
    try {
      const cfgToSave = isCurrentMonth ? { ...inputConfigDraft } : { ...inputConfigDraft, month: inputMonth }
      await saveConfig(cfgToSave, team)
      setInputConfig(cfgToSave)
      if (isCurrentMonth) { setCurrentConfigMonth(cfgToSave.month); setInputMonth(cfgToSave.month) }
      setEditingInputConfig(false)
      setInputConfigMsg('Config saved.')
      if (!isCurrentMonth) setAllArchiveData(null)
    } catch (err) { setInputConfigMsg(`Error: ${err.message}`) }
  }

  const handleLoadRoster = async (month) => {
    if (!month) return
    try {
      const data = await getArchivedMonth(month, team)
      const namedGuides = data?.guides?.filter(g => g.name)
      if (!namedGuides?.length) return
      markEdited()
      const base = { ...EMPTY_GUIDE }
      setInputGuides(namedGuides.map(g => ({
        ...base,
        name: g.name,
        email: g.email || '',
        ...(teamDef.hasChannel ? { channel: g.channel || 'voice' } : {}),
        ...(hasTamRoles ? { tam_role: g.tam_role || defaultTamRole } : {}),
      })))
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
      const guides = await getGuides(team)
      const active = guides.filter(g => g.active)
      if (!active.length) return
      markEdited()
      const base = { ...EMPTY_GUIDE }
      setInputGuides(active.map(g => ({
        ...base,
        name: g.name,
        email: g.email || '',
        ...(teamDef.hasChannel ? { channel: g.channel || 'voice' } : {}),
        ...(hasTamRoles ? { tam_role: g.tam_role || defaultTamRole } : {}),
      })))
      setShowRosterPicker(false)
    } catch { /* ignore */ }
  }

  const loadTeamGuides = async () => {
    setTeamLoading(true); setTeamError('')
    try { setTeamGuides(await getGuidesWithHistory(team)) } catch (err) { setTeamError(err.message) }
    setTeamLoading(false)
  }

  useEffect(() => {
    if (tab === 'manage-team' && teamGuides === null) loadTeamGuides()
  }, [tab])

  useEffect(() => {
    if (tab !== 'qa') return
    let cancelled = false
    setQaLoading(true); setQaError('')
    getQaReviews(qaMonth, team)
      .then(data => { if (!cancelled) { setQaReviews(data); setQaLoading(false) } })
      .catch(err => { if (!cancelled) { setQaError(err.message); setQaLoading(false) } })
    getGuides(team)
      .then(guides => { if (!cancelled) setQaGuideNames(guides.filter(g => g.active).map(g => g.name)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tab, qaMonth, team])

  const handleAddGuide = async (e) => {
    e.preventDefault()
    setAddGuideMsg(null)
    const trimmed = addGuideName.trim()
    try {
      await addGuide({ name: trimmed, channel: addGuideChannel, team, tamRole: addGuideTamRole })
      setAddGuideName('')
      setAddGuideMsg({ ok: true, text: `${trimmed} added.` })
      setTimeout(() => setAddGuideMsg(null), 3000)
      await loadTeamGuides()
    } catch (err) { setAddGuideMsg({ ok: false, text: err.message }) }
  }

  const handleSaveEditGuide = async (guide) => {
    setEditGuideMsg(null)
    try {
      await updateGuide(guide.name, editDraft)
      setEditingGuideName(null); setEditDraft({})
      await loadTeamGuides()
    } catch (err) { setEditGuideMsg({ ok: false, text: err.message }) }
  }

  const handleToggleActive = async (guide) => {
    try { await updateGuide(guide.name, { active: !guide.active }); await loadTeamGuides() }
    catch (err) { setTeamError(err.message) }
  }

  const handleDeleteGuide = async (guide) => {
    setTeamError('')
    try { await deleteGuide(guide.name); await loadTeamGuides() }
    catch (err) { setTeamError(err.message) }
  }

  const handleResetGuidePassword = async (guide) => {
    try { await resetGuidePassword(guide.name); setTeamError('') }
    catch (err) { setTeamError(err.message) }
  }

  const handleAddQaReview = async () => {
    const score = parseFloat(qaScore)
    if (!qaGuideName) return setQaAddMsg('Select a guide.')
    if (isNaN(score) || score < 0 || score > 100) return setQaAddMsg('Score must be 0–100.')
    if (!qaDate) return setQaAddMsg('Select a date.')
    setQaAddMsg('')
    try {
      await addQaReview({ guideName: qaGuideName, score, reviewDate: qaDate, team })
      setQaScore('')
      setQaReviews(await getQaReviews(qaMonth, team))
    } catch (err) { setQaAddMsg(err.message) }
  }

  const handleDeleteQaReview = async (review) => {
    try { await deleteQaReview(review.id, review.guide_name, review.month, team); setQaReviews(await getQaReviews(qaMonth, team)) }
    catch (err) { setQaError(err.message) }
  }

  const handleSaveEditReview = async (review) => {
    const score = parseFloat(editReviewScore)
    if (isNaN(score) || score < 0 || score > 100) return
    try {
      await updateQaReview(review.id, review.guide_name, review.month, { score, reviewDate: editReviewDate }, team)
      setEditingReviewId(null)
      setQaReviews(await getQaReviews(qaMonth, team))
    } catch (err) { setQaError(err.message) }
  }

  const trendMonths = Object.keys(allArchiveData || {}).filter(m => m !== currentConfigMonth)

  const allGuideNames = allArchiveData
    ? [...new Set(trendMonths.flatMap(m => (allArchiveData[m]?.results || []).filter(Boolean).map(r => r.name)))].sort()
    : []

  const trendRows = trendGuide && allArchiveData
    ? trendMonths.map(month => {
        const result = allArchiveData[month]?.results?.find(r => r?.name === trendGuide)
        return result ? { month, ...result } : null
      }).filter(Boolean).sort((a, b) => a.month.localeCompare(b.month))
    : []

  const teamTrendRows = allArchiveData
    ? trendMonths.filter(m => allArchiveData[m]?.averages)
        .map(m => ({ month: m, ...allArchiveData[m].averages }))
        .sort((a, b) => a.month.localeCompare(b.month))
    : []

  const trendDelta = (arr) => arr.length >= 2 ? arr[arr.length - 1] - arr[arr.length - 2] : null

  const groupedQaReviews = useMemo(() => {
    const map = {}
    qaReviews.forEach(r => { if (!map[r.guide_name]) map[r.guide_name] = []; map[r.guide_name].push(r) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([name, reviews]) => ({
      name, reviews,
      avg: reviews.length ? Math.round(reviews.reduce((s, r) => s + Number(r.score), 0) / reviews.length * 100) / 100 : null,
    }))
  }, [qaReviews])

  const TABS = [
    ['input', 'Input'],
    ...(teamDef.hasQaReviews ? [['qa', teamDef.qaTabLabel]] : []),
    ['team-trend', 'Team Trend'],
    ['trend', 'Guide Trend'],
    ['titans', 'Tech Titans'],
    ['manage-team', 'Manage Team'],
  ]

  // Build TH hint for each metric def
  const thHint = (def) => {
    if (def.tamTargets) {
      const cfg = inputConfig?.[def.configKey]
      if (def.tamTierMap) {
        return (
          <span className="th-hint th-hint-stack">
            {Object.entries(def.tamTierMap).map(([tierLabel, cfgKey]) => (
              <span key={cfgKey}>{tierLabel}: {def.prefix}{cfg?.[cfgKey] ?? def.tamTargetMap?.[tierLabel]}{def.suffix}</span>
            ))}
          </span>
        )
      }
      return (
        <span className="th-hint th-hint-stack">
          <span>TAM 1&amp;2: {cfg?.tam1_2Target ?? def.tamTargetMap['TAM 1']}{def.suffix}</span>
          <span>TAM 3: {cfg?.tam3Target ?? def.tamTargetMap['TAM 3']}{def.suffix}</span>
        </span>
      )
    }
    if (def.channelSplit && def.configKeyVoice && def.configKeyMessaging) {
      return (
        <span className="th-hint th-hint-stack">
          <span>Voice: {def.prefix}{inputConfig?.[def.configKeyVoice]?.target}{def.suffix}</span>
          <span>Msg: {def.prefix}{inputConfig?.[def.configKeyMessaging]?.target}{def.suffix}</span>
        </span>
      )
    }
    return <span className="th-hint">target: {def.prefix}{inputConfig?.[def.configKey]?.target}{def.suffix}</span>
  }

  return (
    <div className="view-container">
      <div className="supervisor-header">
        <h2>Supervisor Dashboard</h2>
      </div>

      <div className="tabs">
        {TABS.map(([t, label]) => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {/* ── INPUT TAB ── */}
      {tab === 'input' && (
        <div className="history-tab">
          <div className="history-controls">
            <label className="history-month-select">
              <span>Month</span>
              <select value={inputMonth} onChange={e => setInputMonth(e.target.value)}>
                {allInputMonths.map(m => (
                  <option key={m} value={m}>{fmtMonth(m)}{m === currentConfigMonth ? ' (current)' : ''}</option>
                ))}
              </select>
            </label>
          </div>

          {(inputLoading || !inputConfig) && <p className="subtext">Loading…</p>}

          {!inputLoading && inputConfig && (
            <>
              {/* Config / Targets */}
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
                            value={inputConfigDraft?.month ? inputConfigDraft.month.split('-')[1] : ''}
                            onChange={e => {
                              const [year] = (inputConfigDraft?.month || '-').split('-')
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
                            value={inputConfigDraft?.month ? inputConfigDraft.month.split('-')[0] : ''}
                            onChange={e => {
                              const [, month] = (inputConfigDraft?.month || '-').split('-')
                              setInputConfigDraft({ ...inputConfigDraft, month: `${e.target.value}-${month || '01'}` })
                            }}
                            required
                          >
                            <option value="">Year</option>
                            {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                    <table className="targets-table">
                      <thead><tr><th>Metric</th><th>Target</th></tr></thead>
                      <tbody>
                        {configRows.map(({ configKey, field, label }) => (
                          <tr key={`${configKey}-${field}`}>
                            <td className="targets-metric-name">{label}</td>
                            <td>
                              <input
                                type="number"
                                className="targets-input"
                                value={inputConfigDraft?.[configKey]?.[field] ?? ''}
                                onChange={e => setInputConfigDraft({
                                  ...inputConfigDraft,
                                  [configKey]: { ...inputConfigDraft?.[configKey], [field]: parseFloat(e.target.value) || e.target.value }
                                })}
                                step="0.01"
                                required
                              />
                            </td>
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
                    <thead><tr><th>Metric</th><th>Target</th></tr></thead>
                    <tbody>
                      {configRows.map(({ configKey, field, label, prefix, suffix }) => {
                        const c = inputConfig?.[configKey]
                        if (!c) return null
                        return (
                          <tr key={`${configKey}-${field}`}>
                            <td className="targets-metric-name">{label}</td>
                            <td className="targets-val targets-val-target">{prefix}{c[field]}{suffix}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Roster picker */}
              {showRosterPicker && (
                <div className="new-month-banner">
                  <span>Start this month with…</span>
                  <div className="new-month-controls">
                    <button type="button" className="btn-secondary" onClick={handleLoadActiveGuides}>Active Guides</button>
                    {(archivedMonths || []).filter(m => m !== currentConfigMonth).length > 0 && (
                      <>
                        <span className="cfg-sep">or import from</span>
                        <select value={rosterPickMonth} onChange={e => setRosterPickMonth(e.target.value)}>
                          <option value="">— previous month —</option>
                          {(archivedMonths || []).filter(m => m !== currentConfigMonth).map(m => (
                            <option key={m} value={m}>{fmtMonth(m)}</option>
                          ))}
                        </select>
                        <button type="button" className="btn-secondary" disabled={!rosterPickMonth} onClick={() => handleLoadRoster(rosterPickMonth)}>Import Names</button>
                      </>
                    )}
                    <button type="button" className="btn-ghost" onClick={() => setShowRosterPicker(false)}>Start Fresh</button>
                  </div>
                </div>
              )}

              {/* Team averages for past months */}
              {!isCurrentMonth && inputResults.some(Boolean) && (() => {
                const valid = inputResults.filter(Boolean)
                if (!valid.length) return null
                const avg = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100
                const passRate = Math.round(valid.filter(r => r.passing).length / valid.length * 100) / 100
                return (
                  <div className="history-section">
                    <h4>Team Averages</h4>
                    <div className="history-averages">
                      {metricDefs.map(def => {
                        const val = avg(valid.map(r => r.actuals[def.key]))
                        const pts = avg(valid.map(r => r[def.key]))
                        return (
                          <div key={def.key} className="hist-avg-stat">
                            <span className="hist-avg-label">Avg {def.label}</span>
                            <span className="hist-avg-val">{fmtActual(def, val)}</span>
                            <span className="hist-avg-pts" style={{ color: scoreColor(pts) }}>{pts > 0 ? '+' : ''}{pts} pts</span>
                          </div>
                        )
                      })}
                      <div className="hist-avg-stat">
                        <span className="hist-avg-label">Avg MIS</span>
                        <span className="hist-avg-val">{fmtSigned(avg(valid.map(r => r.total)))}</span>
                      </div>
                      <div className="hist-avg-stat">
                        <span className="hist-avg-label">Pass Rate</span>
                        <span className={`pass-badge small ${passRate >= 0.5 ? 'pass' : 'fail'}`}>
                          {Math.round(passRate * valid.length)}/{valid.length} ({Math.round(passRate * 100)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Input grid + results */}
              <div className="results-card">
                <div className="results-header">
                  <h3>{isCurrentMonth ? `${fmtMonth(inputMonth)} — In Progress` : fmtMonth(inputMonth)}</h3>
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
                        {teamDef.hasChannel && <th>Channel</th>}
                        {metricDefs.map(def => <th key={def.key}>{def.label} {thHint(def)}</th>)}
                        <th>Accountable Days</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputGuides.map((g, i) => {
                        const days = parseFloat(g.days)
                        return (
                          <tr key={i}>
                            <td>
                              <div className="cell-col">
                                <div className="cell-header" />
                                <input value={g.name} onChange={e => handleGuideChange(i, 'name', e.target.value)} placeholder="Name" />
                              </div>
                            </td>
                            {teamDef.hasChannel && (
                              <td>
                                <div className="cell-col">
                                  <div className="cell-header" />
                                  <select value={g.channel || 'voice'} onChange={e => handleGuideChange(i, 'channel', e.target.value)} className="channel-select">
                                    <option value="voice">Voice</option>
                                    <option value="messaging">Messaging</option>
                                  </select>
                                </div>
                              </td>
                            )}
                            {metricDefs.map(def => {
                              if (def.entryMode === 'perday') {
                                const modeKey = `${def.key}Mode`
                                const totalVal = parseFloat(g[def.key])
                                const computed = g[modeKey] === 'total' && !isNaN(totalVal) && days > 0 ? totalVal / days : null
                                return (
                                  <td key={def.key}>
                                    <div className="cell-col">
                                      <div className="cell-header">
                                        <button type="button" className={`mini-toggle ${g[modeKey] === 'perday' ? 'active' : ''}`} onClick={() => toggleMetricMode(i, def.key)}>avg</button>
                                        <button type="button" className={`mini-toggle ${g[modeKey] === 'total' ? 'active' : ''}`} onClick={() => toggleMetricMode(i, def.key)}>total</button>
                                      </div>
                                      <input type="number" value={g[def.key]} onChange={e => handleGuideChange(i, def.key, e.target.value)} placeholder={g[modeKey] === 'total' ? `Total ${def.label}` : 'Per day'} step="0.01" />
                                      {computed !== null && <span className="computed-hint">{def.prefix}{computed.toFixed(2)}{def.suffix}</span>}
                                    </div>
                                  </td>
                                )
                              }
                              // percent entry
                              const isQaMetric = !teamDef.qaNotInMis && def.key === teamDef.qaMetricKey
                              return (
                                <td key={def.key}>
                                  <div className="cell-col">
                                    <div className="cell-header" />
                                    <input type="number" value={g[def.key]} onChange={e => handleGuideChange(i, def.key, e.target.value)} placeholder={`0–${def.maxEntry || 100}`} step="0.01" min="0" max={def.maxEntry || 100} />
                                    {isQaMetric && (() => {
                                      const avg = inputQaAverages[g.name]
                                      if (avg == null) return null
                                      const typed = parseFloat(g[def.key])
                                      if (isNaN(typed) || Math.abs(typed - avg) < 0.005) return null
                                      return <span className="qa-mismatch-hint" title={`Review average is ${avg}`}>⚠ avg {avg}</span>
                                    })()}
                                  </div>
                                </td>
                              )
                            })}
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

                {inputGuides.some(g => g.name) && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <table className="score-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          {teamDef.hasChannel && <th>Channel</th>}
                          {metricDefs.map(def => <th key={def.key}>{def.label}</th>)}
                          <th>Total MIS</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inputResults.map((r, i) => {
                          const g = inputGuides[i]
                          if (!g.name) return null
                          if (r) {
                            return (
                              <tr key={i}>
                                <td>{r.name}</td>
                                {teamDef.hasChannel && <td>{r.channel === 'messaging' ? 'Messaging' : 'Voice'}</td>}
                                {metricDefs.map(def => (
                                  <td key={def.key}>
                                    <div className="result-metric-cell">
                                      <span className="result-actual">{fmtActual(def, r.actuals[def.key])}</span>
                                      <span className="result-points" style={{ color: scoreColor(r[def.key]) }}>{fmtSigned(r[def.key])} pts</span>
                                    </div>
                                  </td>
                                ))}
                                <td style={{ color: scoreColor(r.total), fontWeight: 'bold' }}>{fmtSigned(r.total)}</td>
                                <td><span className={`pass-badge small ${r.passing ? 'pass' : 'fail'}`}>{r.passing ? 'On Track' : 'Off Track'}</span></td>
                              </tr>
                            )
                          }
                          // Partial row
                          const days = parseFloat(g.days)
                          return (
                            <tr key={i}>
                              <td>{g.name}</td>
                              {teamDef.hasChannel && <td>{g.channel === 'messaging' ? 'Messaging' : 'Voice'}</td>}
                              {metricDefs.map(def => {
                                let displayVal = null
                                if (def.entryMode === 'perday') {
                                  const val = g[`${def.key}Mode`] === 'total' && !isNaN(days) && days > 0
                                    ? parseFloat(g[def.key]) / days : parseFloat(g[def.key])
                                  displayVal = !isNaN(val) ? fmtActual(def, val) : null
                                } else {
                                  const val = parseFloat(g[def.key])
                                  displayVal = !isNaN(val) ? fmtActual(def, val) : null
                                }
                                return <td key={def.key}>{displayVal ?? '—'}</td>
                              })}
                              <td>—</td>
                              <td>—</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── QA / AQI REVIEWS TAB ── */}
      {tab === 'qa' && (
        <div className="qa-tab">
          {teamDef.qaNotInMis && (
            <div className="qa-not-in-mis-notice">
              Reviews are tracked here but are not included in MIS scores for this team.
            </div>
          )}
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
              <input type="number" min="0" max="100" placeholder="Score (0–100)" value={qaScore} onChange={e => setQaScore(e.target.value)} />
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
            )}
        </div>
      )}

      {/* ── TEAM TREND TAB ── */}
      {tab === 'team-trend' && (
        <div className="trend-tab">
          {!archivedMonths?.length ? (
            <p className="subtext">No data yet.</p>
          ) : !allArchiveData ? (
            <p className="subtext">Loading…</p>
          ) : teamTrendRows.length === 0 ? (
            <p className="subtext">No completed months to show trends for yet.</p>
          ) : (() => {
            const misVals = teamTrendRows.map(r => r.total)
            return (
              <>
                <div className="trend-cards">
                  {metricDefs.map((def, idx) => {
                    const ptsVals = teamTrendRows.map(r => r[`${def.key}Pts`])
                    const dispVals = teamTrendRows.map(r => r[def.key])
                    const color = SPARKLINE_COLORS[idx % SPARKLINE_COLORS.length]
                    const d = trendDelta(dispVals)
                    const dPts = trendDelta(ptsVals)
                    return (
                      <div key={def.key} className="trend-card">
                        <span className="trend-card-label">Avg {def.label}</span>
                        <Sparkline values={ptsVals} color={color} />
                        <div className="trend-card-footer">
                          <span className="trend-card-latest" style={{ color }}>{fmtActual(def, dispVals[dispVals.length - 1])}</span>
                          {d != null && (
                            <span className="trend-delta" style={{ color: d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#f59e0b' }}>
                              {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {fmtActual(def, Math.abs(d))}
                            </span>
                          )}
                        </div>
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
                      </div>
                    )
                  })}
                  {(() => {
                    const lastMis = misVals[misVals.length - 1]
                    const d = trendDelta(misVals)
                    return (
                      <div className="trend-card">
                        <span className="trend-card-label">Avg Total MIS</span>
                        <Sparkline values={misVals} color={scoreColor(lastMis)} />
                        <div className="trend-card-footer">
                          <span className="trend-card-latest" style={{ color: scoreColor(lastMis) }}>{fmtSigned(lastMis)}</span>
                          {d != null && (
                            <span className="trend-delta" style={{ color: d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#f59e0b' }}>
                              {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {fmtSigned(Math.abs(d))}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
                <table className="score-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Guides</th>
                      {metricDefs.map(def => <th key={def.key}>Avg {def.label}</th>)}
                      <th>Avg MIS</th>
                      <th>Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamTrendRows.map(r => (
                      <tr key={r.month}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtMonth(r.month)}</td>
                        <td>{r.count}</td>
                        {metricDefs.map(def => (
                          <td key={def.key}>
                            <div className="result-metric-cell">
                              <span className="result-actual">{fmtActual(def, r[def.key])}</span>
                              <span className="result-points" style={{ color: scoreColor(r[`${def.key}Pts`]) }}>{fmtSigned(r[`${def.key}Pts`])} pts</span>
                            </div>
                          </td>
                        ))}
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
            <p className="subtext">No data yet.</p>
          ) : (
            <>
              <div className="trend-guide-select">
                <span className="trend-label">Select guide</span>
                <select value={trendGuide} onChange={e => setTrendGuide(e.target.value)} disabled={!allArchiveData}>
                  <option value="">— choose —</option>
                  {allGuideNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                {!allArchiveData && <span className="subtext">Loading…</span>}
              </div>

              {trendGuide && trendRows.length === 0 && <p className="subtext">No data found for {trendGuide}.</p>}

              {trendRows.length > 0 && (() => {
                const misVals = trendRows.map(r => r.total)
                return (
                  <>
                    <div className="trend-cards">
                      {metricDefs.map((def, idx) => {
                        const ptsVals = trendRows.map(r => r[def.key])
                        const dispVals = trendRows.map(r => r.actuals[def.key])
                        const color = SPARKLINE_COLORS[idx % SPARKLINE_COLORS.length]
                        const d = trendDelta(dispVals)
                        const dPts = trendDelta(ptsVals)
                        return (
                          <div key={def.key} className="trend-card">
                            <span className="trend-card-label">{def.label}</span>
                            <Sparkline values={ptsVals} color={color} />
                            <div className="trend-card-footer">
                              <span className="trend-card-latest" style={{ color }}>{fmtActual(def, dispVals[dispVals.length - 1])}</span>
                              {d != null && (
                                <span className="trend-delta" style={{ color: d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#f59e0b' }}>
                                  {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {fmtActual(def, Math.abs(d))}
                                </span>
                              )}
                            </div>
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
                          </div>
                        )
                      })}
                      {(() => {
                        const lastMis = misVals[misVals.length - 1]
                        const d = trendDelta(misVals)
                        return (
                          <div className="trend-card">
                            <span className="trend-card-label">Total MIS</span>
                            <Sparkline values={misVals} color={scoreColor(lastMis)} />
                            <div className="trend-card-footer">
                              <span className="trend-card-latest" style={{ color: scoreColor(lastMis) }}>{fmtSigned(lastMis)}</span>
                              {d != null && (
                                <span className="trend-delta" style={{ color: d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#f59e0b' }}>
                                  {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {fmtSigned(Math.abs(d))}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    <table className="score-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          {metricDefs.map(def => <th key={def.key}>{def.label}</th>)}
                          <th>Total MIS</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendRows.map(r => (
                          <tr key={r.month}>
                            <td style={{ whiteSpace: 'nowrap' }}>{fmtMonth(r.month)}</td>
                            {metricDefs.map(def => (
                              <td key={def.key}>
                                <div className="result-metric-cell">
                                  <span className="result-actual">{fmtActual(def, r.actuals[def.key])}</span>
                                  <span className="result-points" style={{ color: scoreColor(r[def.key]) }}>{fmtSigned(r[def.key])} pts</span>
                                </div>
                              </td>
                            ))}
                            <td style={{ color: scoreColor(r.total), fontWeight: 'bold' }}>{fmtSigned(r.total)}</td>
                            <td><span className={`pass-badge small ${r.passing ? 'pass' : 'fail'}`}>{r.passing ? 'On Track' : 'Off Track'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* ── TECH TITANS TAB ── */}
      {tab === 'titans' && <TechTitans />}

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
                      {teamDef.hasChannel && <th>Default Channel <span className="th-hint">per-month override in Input tab</span></th>}
                      {hasTamRoles && <th>Guide Type</th>}
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamGuides.length === 0 && (
                      <tr><td colSpan={3 + (teamDef.hasChannel ? 1 : 0) + (team === 'escalations' ? 1 : 0)} className="invalid-row">No guides on the team yet.</td></tr>
                    )}
                    {teamGuides.map(guide => (
                      <tr key={guide.name} className={guide.active ? '' : 'guide-inactive-row'}>
                        {editingGuideName === guide.name ? (
                          <>
                            <td><span className="guide-name-cell">{guide.name}</span></td>
                            {teamDef.hasChannel && (
                              <td>
                                <select value={editDraft.channel ?? guide.channel} onChange={e => setEditDraft({ ...editDraft, channel: e.target.value })}>
                                  <option value="voice">Voice</option>
                                  <option value="messaging">Messaging</option>
                                </select>
                              </td>
                            )}
                            {hasTamRoles && (
                              <td>
                                <select value={editDraft.tam_role ?? guide.tam_role ?? defaultTamRole} onChange={e => setEditDraft({ ...editDraft, tam_role: e.target.value })}>
                                  {tamRoleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                              </td>
                            )}
                            <td><span className={`guide-status-badge ${guide.active ? 'active' : 'inactive'}`}>{guide.active ? 'Active' : 'Inactive'}</span></td>
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
                            {teamDef.hasChannel && <td>{guide.channel === 'messaging' ? 'Messaging' : 'Voice'}</td>}
                            {hasTamRoles && <td>{guide.tam_role || defaultTamRole}</td>}
                            <td><span className={`guide-status-badge ${guide.active ? 'active' : 'inactive'}`}>{guide.active ? 'Active' : 'Inactive'}</span></td>
                            <td>
                              <div className="manage-guide-actions">
                                <button className="btn-ghost btn-sm" onClick={() => {
                                  setEditingGuideName(guide.name)
                                  setEditDraft({ channel: guide.channel, tam_role: guide.tam_role || defaultTamRole })
                                  setEditGuideMsg(null)
                                }}>Edit</button>
                                <button className="btn-ghost btn-sm" onClick={() => handleToggleActive(guide)}>
                                  {guide.active ? 'Deactivate' : 'Reactivate'}
                                </button>
                                <button className="btn-ghost btn-sm" onClick={() => handleResetGuidePassword(guide)} title="Reset password to 'changeme'">Reset PW</button>
                                {!guide.hasHistory && (
                                  <button className="btn-danger-sm" onClick={() => handleDeleteGuide(guide)}>Remove</button>
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
                  <input type="text" placeholder="Guide name" value={addGuideName} onChange={e => setAddGuideName(e.target.value)} required />
                  {teamDef.hasChannel && (
                    <select value={addGuideChannel} onChange={e => setAddGuideChannel(e.target.value)}>
                      <option value="voice">Voice</option>
                      <option value="messaging">Messaging</option>
                    </select>
                  )}
                  {hasTamRoles && (
                    <select value={addGuideTamRole} onChange={e => setAddGuideTamRole(e.target.value)}>
                      {tamRoleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                  <button type="submit" className="btn-primary">Add Guide</button>
                  {addGuideMsg && (
                    <span className={addGuideMsg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>{addGuideMsg.text}</span>
                  )}
                </form>
                <p className="subtext" style={{ marginTop: '0.5rem' }}>New guides are created with the default password "changeme".</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
