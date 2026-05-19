import { useState, useEffect, useRef } from 'react'
import SupervisorView from './SupervisorView'
import TechTitans from './TechTitans'
import {
  getTeamMonthlyAverages, getConfigMonths, getConfigForMonth, getConfig, saveConfig,
  getManagerUsernames, addManagerUser, removeManagerUser,
  getSupervisorUsernames, addSupervisorUser, removeSupervisorUser,
  getActivityLog, logActivity,
  getAiAnalysis, saveAiAnalysis,
} from '../utils/storage'
import { TEAM_DEFS } from '../utils/teamConfig'
import { callGoCaaS } from '../utils/gocaas'

const TEAM_IDS = ['pss', 'activations', 'escalations']

const ALL_TABS = [
  ['overview',      'Overview'],
  ['titans',        'Tech Titans'],
  ['pss',           'PSS'],
  ['activations',   'Activations'],
  ['escalations',   'Escalations'],
  ['manage-users',  'Manage Users'],
  ['activity',      'Activity'],
]

const MANAGER_ONLY_TABS = new Set(['manage-users', 'activity'])

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmtMonthShort = m => SHORT_MONTHS[+m.split('-')[1] - 1]
const fmtMonthFull  = m => `${SHORT_MONTHS[+m.split('-')[1] - 1]} ${m.split('-')[0]}`

const fmtMIS     = v => (v > 0 ? '+' : '') + v.toFixed(2)
const misColor   = v => v > 0 ? '#22c55e' : v < 0 ? '#ef4444' : '#f59e0b'
const fmtMetric  = (def, val) => `${def.prefix || ''}${val.toFixed(1)}${def.suffix || ''}`

export default function ManagerView({ leaderUser, canManageUsers = true, onLogout, activeTab: externalTab = null, onTabChange = null, subTab = null, onSubTabChange = null }) {
  const [_internalTab, _setInternalTab] = useState('overview')
  const activeTab  = externalTab  ?? _internalTab
  const setActiveTab = onTabChange ?? _setInternalTab

  const [trendData, setTrendData]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [targetTeam, setTargetTeam] = useState(null)

  const loadTrends = () => {
    setLoading(true)
    setError('')
    Promise.all(TEAM_IDS.map(t => getTeamMonthlyAverages(t)))
      .then(([pss, activations, escalations]) => {
        setTrendData({ pss, activations, escalations })
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }

  useEffect(() => { loadTrends() }, [])

  return (
    <div className="manager-view">

      {activeTab === 'overview' && (
        <OverviewTab
          trendData={trendData}
          loading={loading}
          error={error}
          onSetTargets={setTargetTeam}
          currentUser={leaderUser?.username}
        />
      )}
      {activeTab === 'titans'       && <div className="manager-overview"><TechTitans /></div>}
      {activeTab === 'pss'          && <SupervisorView team="pss"         currentUser={leaderUser.username} activeTab={subTab} onTabChange={onSubTabChange} />}
      {activeTab === 'activations'  && <SupervisorView team="activations" currentUser={leaderUser.username} activeTab={subTab} onTabChange={onSubTabChange} />}
      {activeTab === 'escalations'  && <SupervisorView team="escalations" currentUser={leaderUser.username} activeTab={subTab} onTabChange={onSubTabChange} />}
      {activeTab === 'manage-users' && <ManageUsersTab currentUser={leaderUser.username} />}
      {activeTab === 'activity'     && <ActivityTab />}

      {targetTeam && (
        <SetTargetsModal
          team={targetTeam}
          onClose={() => setTargetTeam(null)}
          onSaved={loadTrends}
        />
      )}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

const signColor = d => d > 0 ? 'var(--green)' : d < 0 ? 'var(--red)' : 'var(--text-muted)'
const fmtDeltaNum = (d, toFixed = 2) =>
  d === null ? null : `${d > 0 ? '▲' : d < 0 ? '▼' : '—'} ${Math.abs(d).toFixed(toFixed)}`
const vtPct = (cur, tgt) => (cur != null && tgt != null && tgt !== 0) ? Math.round((cur - tgt) / tgt * 1000) / 10 : null
const fmtVtPct = (cur, tgt) => { const p = vtPct(cur, tgt); return p === null ? null : `${p > 0 ? '▲' : p < 0 ? '▼' : '—'} ${Math.abs(p).toFixed(1)}%` }

function buildAnalysisPrompt(trendData) {
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const fmtM = m => `${SHORT_MONTHS[+m.split('-')[1] - 1]} ${m.split('-')[0]}`

  const sections = TEAM_IDS.map(team => {
    const teamDef = TEAM_DEFS[team]
    const data = trendData[team].slice(-4)
    if (data.length === 0) return `${teamDef.label}: No data available.`
    const rows = data.map(d => {
      const metricStr = teamDef.metricDefs.map(def => {
        const val = d.metrics?.[def.key]
        const tgt = d.avgTargets?.[def.key]
        const vt = (val != null && tgt != null && tgt !== 0) ? ((val - tgt) / tgt * 100).toFixed(1) : null
        return `${def.overviewLabel || def.label}: ${val != null ? val.toFixed(2) : 'N/A'}${vt !== null ? ` (${+vt > 0 ? '+' : ''}${vt}% vs target)` : ''}`
      }).join(', ')
      return `  ${fmtM(d.month)}: MIS=${d.avgMIS.toFixed(2)}, PassRate=${Math.round(d.passRate * 100)}%, Guides=${d.guideCount}, [${metricStr}]`
    }).join('\n')
    return `${teamDef.label} (${teamDef.fullName}):\n${rows}`
  })

  return `You are a performance coach reviewing monthly data for three sales teams. Each team has guides (employees) whose work is measured against targets each month.

Here is the data:

${sections.join('\n\n')}

"MIS" is an overall performance score — positive means the team is beating targets on average, negative means they're falling short. "PassRate" is the share of guides who are meeting or exceeding their targets that month.

Write in plain, direct English. No jargon, no bullet headers.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "summary": "2-3 sentences on how the teams are doing overall and the clearest trend you see across all three.",
  "highlights": [
    { "type": "positive", "text": "One clear observation. Name the team and cite the actual numbers." }
  ],
  "targetAdvice": [
    { "team": "PSS", "advice": "Name the specific metric, say whether to raise or lower the target, give a concrete number, and explain why in one sentence." }
  ]
}

For targetAdvice: if a team is consistently beating a metric target every month, that target is too easy — tell them to raise it and say by how much. If they're consistently missing, say whether to lower the target or flag it as a growth area. Be direct — say things like "Raise the CPD target from 17 to 19" not "consider adjusting targets". Include one advice entry per team (PSS, Activations, Escalations). Include 3-5 highlights with a mix of positive, negative, and neutral types.

Two priorities should shape every recommendation: First, parity — the three teams compete against each other in a cross-team leaderboard called Tech Titans, so MIS scores need to be roughly comparable across teams. If one team's scores are consistently much higher or lower than the others, call that out and suggest how to bring them in line. Second, keep the fail rate low — very few guides should have a negative MIS score in any given month. Targets should be set high enough to drive month-over-month improvement but not so high that a large share of the team ends up failing. Flag any team where the pass rate looks out of balance with the others.`
}

function parseAIResponse(text) {
  const stripped = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  return JSON.parse(stripped)
}

const fmtAiTs = ts => new Date(ts).toLocaleString('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
})

function OverviewTab({ trendData, loading, error, onSetTargets, currentUser }) {
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiMeta, setAiMeta]         = useState(null)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiError, setAiError]       = useState('')
  const abortRef = useRef(null)

  const generate = (data, username) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setAiLoading(true)
    setAiError('')
    callGoCaaS(buildAnalysisPrompt(data), { signal: controller.signal })
      .then(text => {
        const parsed = parseAIResponse(text)
        saveAiAnalysis(parsed, username).catch(() => {})
        logActivity({ username, team: null, action: 'ai_analysis_generated' })
        setAiAnalysis(parsed)
        setAiMeta({ generatedAt: new Date().toISOString(), generatedBy: username })
        setAiLoading(false)
      })
      .catch(err => {
        if (err.name !== 'AbortError') { setAiError(err.message); setAiLoading(false) }
      })
  }

  useEffect(() => {
    if (!trendData) return
    let cancelled = false
    setAiLoading(true)
    setAiError('')
    getAiAnalysis()
      .then(cached => {
        if (cancelled) return
        if (cached) {
          setAiAnalysis(cached.content)
          setAiMeta({ generatedAt: cached.generated_at, generatedBy: cached.generated_by })
          setAiLoading(false)
        } else {
          generate(trendData, currentUser)
        }
      })
      .catch(err => {
        if (!cancelled) { setAiError(err.message); setAiLoading(false) }
      })
    return () => { cancelled = true; abortRef.current?.abort() }
  }, [trendData])

  const handleRegenerate = () => {
    if (!trendData || aiLoading) return
    generate(trendData, currentUser)
  }

  if (loading) return <p className="subtext" style={{ padding: '2rem' }}>Loading team data…</p>
  if (error)   return <p className="error-msg" style={{ padding: '2rem' }}>{error}</p>
  if (!trendData) return null

  const latestEntry = arr => arr.length ? arr[arr.length - 1] : null
  const prevEntry   = arr => arr.length >= 2 ? arr[arr.length - 2] : null
  const diff = (a, b) => (a != null && b != null) ? Math.round((a - b) * 100) / 100 : null

  const allMonths = [...new Set(
    TEAM_IDS.flatMap(t => trendData[t].map(d => d.month))
  )].sort().slice(-5)

  return (
    <div className="manager-overview">

      {/* ── Team cards ── */}
      <div className="manager-team-cards">
        {TEAM_IDS.map(team => {
          const teamDef = TEAM_DEFS[team]
          const data    = trendData[team]
          const latest  = latestEntry(data)
          const prev    = prevEntry(data)

          return (
            <div key={team} className="manager-team-card">
              <div className="manager-card-header">
                <span className={`tt-team-badge tt-team-${team}`}>{teamDef?.label || team}</span>
                {latest && <span className="manager-card-month">{fmtMonthShort(latest.month)}</span>}
              </div>

              {latest ? (
                <table className="overview-stat-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Val</th>
                      <th>vT</th>
                      <th>MoM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamDef.metricDefs.map(def => {
                      const cur = latest.metrics?.[def.key]
                      const prv = prev?.metrics?.[def.key]
                      const tgt = latest.avgTargets?.[def.key]
                      const vt  = vtPct(cur, tgt)
                      const mom = diff(cur, prv)
                      return (
                        <tr key={def.key}>
                          <td className="ostat-label">{def.overviewLabel || def.label}</td>
                          <td className="ostat-val">{cur != null ? fmtMetric(def, cur) : '—'}</td>
                          <td className="ostat-delta" style={vt !== null ? { color: signColor(vt) } : {}}>
                            {fmtVtPct(cur, tgt) ?? '—'}
                          </td>
                          <td className="ostat-delta" style={mom !== null ? { color: signColor(mom) } : {}}>
                            {fmtDeltaNum(mom, 2) ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="ostat-divider">
                      <td className="ostat-label">Avg MIS</td>
                      <td className="ostat-val" style={{ color: misColor(latest.avgMIS) }}>{fmtMIS(latest.avgMIS)}</td>
                      <td className="ostat-delta">—</td>
                      <td className="ostat-delta" style={{ color: signColor(diff(latest.avgMIS, prev?.avgMIS)) }}>
                        {fmtDeltaNum(diff(latest.avgMIS, prev?.avgMIS)) ?? '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="ostat-label">Pass Rate</td>
                      <td className="ostat-val">{Math.round(latest.passRate * 100)}%</td>
                      <td className="ostat-delta">—</td>
                      <td className="ostat-delta" style={{ color: signColor(diff(latest.passRate, prev?.passRate)) }}>
                        {(() => {
                          const d = diff(latest.passRate, prev?.passRate)
                          return d !== null ? `${d > 0 ? '▲' : d < 0 ? '▼' : '—'} ${Math.abs(Math.round(d * 100))}pp` : '—'
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="subtext">No data yet.</p>
              )}

              <button className="btn-secondary manager-targets-btn" onClick={() => onSetTargets(team)}>
                Set Targets
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Cross-team MIS trend ── */}
      {allMonths.length > 0 && (
        <div>
          <h3 className="manager-section-label">Avg MIS Trend</h3>
          <table className="overview-trend-table">
            <thead>
              <tr>
                <th></th>
                {TEAM_IDS.map(t => <th key={t} className="otrend-team">{TEAM_DEFS[t]?.label || t}</th>)}
              </tr>
            </thead>
            <tbody>
              {allMonths.map(month => (
                <tr key={month}>
                  <td className="otrend-month">{fmtMonthFull(month)}</td>
                  {TEAM_IDS.map(t => {
                    const entry = trendData[t].find(d => d.month === month)
                    return (
                      <td key={t} className="otrend-val">
                        {entry
                          ? <span style={{ color: misColor(entry.avgMIS) }}>{fmtMIS(entry.avgMIS)}</span>
                          : <span className="tt-empty">—</span>
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AI Analysis ── */}
      <div className="ai-analysis-section">
        <div className="ai-analysis-header">
          <span className="ai-analysis-title">AI Analysis</span>
          <div className="ai-analysis-controls">
            {aiMeta && !aiLoading && (
              <span className="ai-meta">
                {fmtAiTs(aiMeta.generatedAt)} · {aiMeta.generatedBy}
              </span>
            )}
            <button
              className="btn-ghost btn-sm"
              onClick={handleRegenerate}
              disabled={aiLoading}
            >
              {aiLoading ? 'Generating…' : 'Regenerate'}
            </button>
          </div>
        </div>
        {aiLoading && (
          <div className="ai-analysis-loading">
            <span className="ai-spinner" />
            Analyzing performance data…
          </div>
        )}
        {aiError && (
          <p className="error-msg" style={{ fontSize: '0.85rem' }}>{aiError}</p>
        )}
        {aiAnalysis && (
          <>
            {aiAnalysis.summary && (
              <p className="ai-summary">{aiAnalysis.summary}</p>
            )}
            {aiAnalysis.highlights?.length > 0 && (
              <div className="ai-highlights">
                {aiAnalysis.highlights.map((h, i) => (
                  <span key={i} className={`ai-highlight ai-highlight-${h.type}`}>{h.text}</span>
                ))}
              </div>
            )}
            {aiAnalysis.targetAdvice?.length > 0 && (
              <div>
                <div className="ai-analysis-subtitle">Target Recommendations</div>
                <div className="ai-target-advice">
                  {aiAnalysis.targetAdvice.map((a, i) => (
                    <div key={i} className="ai-advice-row">
                      <span className="ai-advice-team">
                        <span className={`tt-team-badge tt-team-${a.team?.toLowerCase()}`}>{a.team}</span>
                      </span>
                      <span className="ai-advice-text">{a.advice}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Manage Users Tab ──────────────────────────────────────────────────────────

function ManageUsersTab({ currentUser }) {
  const [managerUsers, setManagerUsers]   = useState([])
  const [mgrsLoading, setMgrsLoading]     = useState(true)
  const [newMgrUsername, setNewMgrUsername] = useState('')
  const [newMgrPw, setNewMgrPw]           = useState('')
  const [addMgrMsg, setAddMgrMsg]         = useState(null)

  const [supervisorUsers, setSupervisorUsers] = useState([])
  const [supsLoading, setSupsLoading]     = useState(true)
  const [newSupUsername, setNewSupUsername] = useState('')
  const [newSupPw, setNewSupPw]           = useState('')
  const [addSupMsg, setAddSupMsg]         = useState(null)

  useEffect(() => {
    getManagerUsernames()
      .then(names => { setManagerUsers(names); setMgrsLoading(false) })
      .catch(() => setMgrsLoading(false))
    getSupervisorUsernames()
      .then(users => { setSupervisorUsers(users); setSupsLoading(false) })
      .catch(() => setSupsLoading(false))
  }, [])

  const handleAddManager = async (e) => {
    e.preventDefault()
    const trimmed = newMgrUsername.trim()
    try {
      await addManagerUser(trimmed, newMgrPw)
      setManagerUsers(await getManagerUsernames())
      setNewMgrUsername(''); setNewMgrPw('')
      setAddMgrMsg({ ok: true, text: `${trimmed} added.` })
      setTimeout(() => setAddMgrMsg(null), 3000)
    } catch (err) {
      setAddMgrMsg({ ok: false, text: err.message })
    }
  }

  const handleRemoveManager = async (username) => {
    try {
      await removeManagerUser(username)
      setManagerUsers(await getManagerUsernames())
    } catch (err) {
      setAddMgrMsg({ ok: false, text: err.message })
    }
  }

  const handleAddSupervisor = async (e) => {
    e.preventDefault()
    const trimmed = newSupUsername.trim()
    try {
      await addSupervisorUser(trimmed, newSupPw)
      setSupervisorUsers(await getSupervisorUsernames())
      setNewSupUsername(''); setNewSupPw('')
      setAddSupMsg({ ok: true, text: `${trimmed} added.` })
      setTimeout(() => setAddSupMsg(null), 3000)
    } catch (err) {
      setAddSupMsg({ ok: false, text: err.message })
    }
  }

  const handleRemoveSupervisor = async (username) => {
    try {
      await removeSupervisorUser(username)
      setSupervisorUsers(await getSupervisorUsernames())
    } catch (err) {
      setAddSupMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="manage-users-tab">
      <div className="manage-users-columns">

        <div className="manage-users-section">
          <h3 className="manager-section-label">Manager Users</h3>
          {mgrsLoading ? (
            <p className="subtext">Loading…</p>
          ) : (
            <ul className="user-list">
              {managerUsers.map(u => (
                <li key={u} className="user-list-item">
                  <span>{u}{u === currentUser && <span className="user-you"> (you)</span>}</span>
                  {u !== currentUser && (
                    <button className="btn-ghost user-remove-btn" onClick={() => handleRemoveManager(u)}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleAddManager} className="password-form" style={{ marginTop: '1rem' }}>
            <label className="password-field">
              <span>Username</span>
              <input type="text" value={newMgrUsername} onChange={e => setNewMgrUsername(e.target.value)} required autoComplete="off" />
            </label>
            <label className="password-field">
              <span>Password</span>
              <input type="password" value={newMgrPw} onChange={e => setNewMgrPw(e.target.value)} required autoComplete="new-password" />
            </label>
            <div className="password-actions">
              <button type="submit" className="btn-secondary">Add Manager</button>
              {addMgrMsg && <span className={addMgrMsg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>{addMgrMsg.text}</span>}
            </div>
          </form>
        </div>

        <div className="manage-users-section">
          <h3 className="manager-section-label">Supervisor Users</h3>
          {supsLoading ? (
            <p className="subtext">Loading…</p>
          ) : (
            <ul className="user-list">
              {supervisorUsers.map(u => (
                <li key={u} className="user-list-item">
                  <span>{u}</span>
                  <button className="btn-ghost user-remove-btn" onClick={() => handleRemoveSupervisor(u)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleAddSupervisor} className="password-form" style={{ marginTop: '1rem' }}>
            <label className="password-field">
              <span>Username</span>
              <input type="text" value={newSupUsername} onChange={e => setNewSupUsername(e.target.value)} required autoComplete="off" />
            </label>
            <label className="password-field">
              <span>Password</span>
              <input type="password" value={newSupPw} onChange={e => setNewSupPw(e.target.value)} required autoComplete="new-password" />
            </label>
            <div className="password-actions">
              <button type="submit" className="btn-secondary">Add Supervisor</button>
              {addSupMsg && <span className={addSupMsg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>{addSupMsg.text}</span>}
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

const ACTION_META = {
  config_saved:           { label: 'Targets Saved',       color: 'var(--blue)'  },
  month_reset:            { label: 'Month Reset',          color: 'var(--red)'   },
  guide_added:            { label: 'Guide Added',          color: 'var(--green)' },
  guide_edited:           { label: 'Guide Edited',         color: 'var(--amber)' },
  qa_added:               { label: 'QA Review Added',      color: 'var(--green)' },
  qa_deleted:             { label: 'QA Review Removed',    color: 'var(--red)'   },
  qa_edited:              { label: 'QA Review Edited',     color: 'var(--amber)' },
  ai_analysis_generated:  { label: 'AI Analysis',          color: 'var(--blue)'  },
}

function fmtTs(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function fmtDetail(action, details, month) {
  const d = details || {}
  switch (action) {
    case 'config_saved': return d.month || month || null
    case 'month_reset':  return month || null
    case 'guide_added':  return d.guide || null
    case 'guide_edited': {
      if (!d.guide) return null
      const changes = d.changes
        ? Object.entries(d.changes).map(([k, v]) => `${k}: ${v}`).join(', ')
        : ''
      return changes ? `${d.guide} — ${changes}` : d.guide
    }
    case 'qa_added':
    case 'qa_edited':              return d.guide ? `${d.guide} — score ${d.score}${month ? ` (${month})` : ''}` : null
    case 'qa_deleted':             return d.guide ? `${d.guide}${month ? ` (${month})` : ''}` : null
    case 'ai_analysis_generated':  return 'Cross-team'
    default:                       return month || null
  }
}

function ActivityTab() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    getActivityLog()
      .then(data => { setEntries(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  if (loading) return <p className="subtext" style={{ padding: '2rem' }}>Loading activity…</p>
  if (error)   return <p className="error-msg" style={{ padding: '2rem' }}>{error}</p>

  return (
    <div className="activity-tab">
      <div className="activity-header">
        <h3 className="manager-section-label">Activity Log</h3>
        <button className="btn-ghost" onClick={load}>Refresh</button>
      </div>
      {entries.length === 0 ? (
        <p className="subtext">No activity recorded yet.</p>
      ) : (
        <div className="activity-feed">
          {entries.map(entry => {
            const meta   = ACTION_META[entry.action] || { label: entry.action, color: 'var(--text-muted)' }
            const detail = fmtDetail(entry.action, entry.details, entry.month)
            return (
              <div key={entry.id} className="activity-entry">
                <div className="activity-entry-main">
                  <span className="activity-badge" style={{ color: meta.color, borderColor: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="activity-user">{entry.username}</span>
                  {entry.team && <span className={`tt-team-badge tt-team-${entry.team}`}>{entry.team}</span>}
                  {detail && <span className="activity-detail">{detail}</span>}
                </div>
                <span className="activity-ts">{fmtTs(entry.created_at)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Set Targets Modal ─────────────────────────────────────────────────────────

function SetTargetsModal({ team, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 7)
  const teamDef = TEAM_DEFS[team]

  const [configMonths, setConfigMonths] = useState([today])
  const [month, setMonth]               = useState(today)
  const [draft, setDraft]               = useState(null)
  const [cfgLoading, setCfgLoading]     = useState(true)
  const [saving, setSaving]             = useState(false)
  const [msg, setMsg]                   = useState(null)

  useEffect(() => {
    getConfigMonths(team).then(months => {
      const all = [...new Set([today, ...months])].sort().reverse()
      setConfigMonths(all)
    }).catch(() => {})
  }, [team])

  useEffect(() => {
    setCfgLoading(true)
    setMsg(null)
    getConfigForMonth(month, team)
      .then(cfg => {
        if (cfg) {
          setDraft({ ...cfg, month })
        } else {
          getConfig(team).then(latest => {
            const { month: _m, ...rest } = latest
            setDraft({ month, ...rest })
          })
        }
        setCfgLoading(false)
      })
      .catch(() => setCfgLoading(false))
  }, [month, team])

  const update = (cfgKey, subKey, value) => {
    const num = parseFloat(value)
    setDraft(d => ({
      ...d,
      [cfgKey]: { ...(d[cfgKey] || {}), [subKey]: isNaN(num) ? value : num },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await saveConfig({ ...draft, month }, team)
      setMsg({ ok: true, text: 'Targets saved.' })
      onSaved?.()
      setTimeout(() => { setMsg(null) }, 3000)
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card targets-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Set Targets</h2>
            <span className={`tt-team-badge tt-team-${team}`} style={{ marginTop: '0.4rem', display: 'inline-block' }}>
              {teamDef.label}
            </span>
          </div>
          <button className="btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="targets-month-row">
          <span className="targets-month-label">Month</span>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="targets-month-select"
          >
            {configMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {cfgLoading ? (
          <p className="subtext">Loading…</p>
        ) : draft && (
          <div className="targets-rows">
            {renderConfigInputs(teamDef, draft, update)}
          </div>
        )}

        <div className="targets-actions">
          <button className="btn-primary" onClick={handleSave} disabled={saving || cfgLoading}>
            {saving ? 'Saving…' : 'Save Targets'}
          </button>
          {msg && (
            <span className={msg.ok ? 'close-month-msg' : 'close-month-msg error-msg'}>
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function renderConfigInputs(teamDef, draft, update) {
  const rows = []

  for (const def of teamDef.metricDefs) {
    const { key, label, configKey, configKeyVoice, configKeyMessaging, channelSplit, tamTargets, tamTierMap } = def

    if (tamTargets && tamTierMap) {
      rows.push(
        <div key={key} className="targets-row">
          <span className="targets-row-label">{label}</span>
          {Object.entries(tamTierMap).map(([tierLabel, cfgKey]) => (
            <label key={cfgKey} className="targets-inline-field">
              <span>{tierLabel}</span>
              <input type="number" step="any"
                value={draft[configKey]?.[cfgKey] ?? ''}
                onChange={e => update(configKey, cfgKey, e.target.value)} />
            </label>
          ))}
        </div>
      )
      continue
    }

    if (tamTargets) {
      rows.push(
        <div key={key} className="targets-row">
          <span className="targets-row-label">{label}</span>
          <label className="targets-inline-field">
            <span>TAM 1&amp;2</span>
            <input type="number" step="any"
              value={draft[configKey]?.tam1_2Target ?? ''}
              onChange={e => update(configKey, 'tam1_2Target', e.target.value)} />
          </label>
          <label className="targets-inline-field">
            <span>TAM 3</span>
            <input type="number" step="any"
              value={draft[configKey]?.tam3Target ?? ''}
              onChange={e => update(configKey, 'tam3Target', e.target.value)} />
          </label>
        </div>
      )
      continue
    }

    if (channelSplit && configKeyVoice) {
      for (const { lbl, cfgKey } of [{ lbl: 'Voice', cfgKey: configKeyVoice }, { lbl: 'Msg', cfgKey: configKeyMessaging }]) {
        rows.push(
          <div key={cfgKey} className="targets-row">
            <span className="targets-row-label">{label} <span className="targets-row-sub">{lbl}</span></span>
            {['min', 'target', 'max'].map(sub => (
              <label key={sub} className="targets-inline-field">
                <span>{sub[0].toUpperCase() + sub.slice(1)}</span>
                <input type="number" step="any"
                  value={draft[cfgKey]?.[sub] ?? ''}
                  onChange={e => update(cfgKey, sub, e.target.value)} />
              </label>
            ))}
          </div>
        )
      }
      continue
    }

    const hasMinMax = 'min' in (teamDef.defaultConfig[configKey] || {})
    rows.push(
      <div key={key} className="targets-row">
        <span className="targets-row-label">{label}</span>
        {hasMinMax
          ? ['min', 'target', 'max'].map(sub => (
              <label key={sub} className="targets-inline-field">
                <span>{sub[0].toUpperCase() + sub.slice(1)}</span>
                <input type="number" step="any"
                  value={draft[configKey]?.[sub] ?? ''}
                  onChange={e => update(configKey, sub, e.target.value)} />
              </label>
            ))
          : (
            <label className="targets-inline-field">
              <span>Target</span>
              <input type="number" step="any"
                value={draft[configKey]?.target ?? ''}
                onChange={e => update(configKey, 'target', e.target.value)} />
            </label>
          )
        }
      </div>
    )
  }

  return rows
}
