import { useState, useEffect } from 'react'
import SupervisorView from './SupervisorView'
import TechTitans from './TechTitans'
import {
  getTeamMonthlyAverages, getConfigMonths, getConfigForMonth, getConfig, saveConfig,
  getManagerUsernames, addManagerUser, removeManagerUser,
  getSupervisorUsernames, addSupervisorUser, removeSupervisorUser,
} from '../utils/storage'
import { TEAM_DEFS } from '../utils/teamConfig'

const TEAM_IDS = ['pss', 'activations', 'escalations']

const TABS = [
  ['overview',      'Overview'],
  ['titans',        'Tech Titans'],
  ['pss',           'PSS'],
  ['activations',   'Activations'],
  ['escalations',   'Escalations'],
  ['manage-users',  'Manage Users'],
]

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmtMonthShort = m => SHORT_MONTHS[+m.split('-')[1] - 1]
const fmtMonthFull  = m => `${SHORT_MONTHS[+m.split('-')[1] - 1]} ${m.split('-')[0]}`

const fmtMIS     = v => (v > 0 ? '+' : '') + v.toFixed(2)
const misColor   = v => v > 0 ? '#22c55e' : v < 0 ? '#ef4444' : '#f59e0b'
const fmtMetric  = (def, val) => `${def.prefix || ''}${val.toFixed(1)}${def.suffix || ''}`

export default function ManagerView({ managerUser, onLogout }) {
  const [activeTab, setActiveTab]   = useState('overview')
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
      <div className="manager-tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={`manager-tab-btn${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          trendData={trendData}
          loading={loading}
          error={error}
          onSetTargets={setTargetTeam}
        />
      )}
      {activeTab === 'titans'       && <div className="manager-overview"><TechTitans /></div>}
      {activeTab === 'pss'          && <SupervisorView team="pss"         currentUser={managerUser.username} />}
      {activeTab === 'activations'  && <SupervisorView team="activations" currentUser={managerUser.username} />}
      {activeTab === 'escalations'  && <SupervisorView team="escalations" currentUser={managerUser.username} />}
      {activeTab === 'manage-users' && <ManageUsersTab currentUser={managerUser.username} />}

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

function OverviewTab({ trendData, loading, error, onSetTargets }) {
  if (loading) return <p className="subtext" style={{ padding: '2rem' }}>Loading team data…</p>
  if (error)   return <p className="error-msg" style={{ padding: '2rem' }}>{error}</p>
  if (!trendData) return null

  const latestEntry = arr => arr.length ? arr[arr.length - 1] : null
  const prevEntry   = arr => arr.length >= 2 ? arr[arr.length - 2] : null

  const allMonths = [...new Set(
    TEAM_IDS.flatMap(t => trendData[t].map(d => d.month))
  )].sort().slice(-6)

  return (
    <div className="manager-overview">

      {/* ── Summary cards ── */}
      <div className="manager-team-cards">
        {TEAM_IDS.map(team => {
          const data   = trendData[team]
          const latest = latestEntry(data)
          const prev   = prevEntry(data)
          const delta  = latest && prev
            ? Math.round((latest.avgMIS - prev.avgMIS) * 100) / 100
            : null

          return (
            <div key={team} className="manager-team-card trend-card">
              <div className="manager-card-header">
                <span className={`tt-team-badge tt-team-${team}`}>{TEAM_DEFS[team]?.label || team}</span>
                {latest && <span className="manager-card-month">{fmtMonthShort(latest.month)}</span>}
              </div>
              {latest ? (
                <>
                  <div className="manager-card-stat">
                    <span className="manager-card-label">Avg MIS</span>
                    <span className="manager-card-value" style={{ color: misColor(latest.avgMIS) }}>
                      {fmtMIS(latest.avgMIS)}
                    </span>
                    {delta !== null && (
                      <span className="manager-card-delta" style={{ color: misColor(delta) }}>
                        {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="manager-card-stat">
                    <span className="manager-card-label">Pass Rate</span>
                    <span className="manager-card-value">{Math.round(latest.passRate * 100)}%</span>
                  </div>
                  <div className="manager-card-stat">
                    <span className="manager-card-label">Guides</span>
                    <span className="manager-card-value">{latest.guideCount}</span>
                  </div>
                  {latest.breakdown && Object.keys(latest.breakdown).length > 0 && (
                    <div className="manager-card-breakdown">
                      {Object.entries(latest.breakdown).map(([key, count]) => (
                        <span key={key} className="manager-card-breakdown-item">
                          {key.charAt(0).toUpperCase() + key.slice(1)}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="subtext">No data yet.</p>
              )}
              <button
                className="btn-secondary manager-targets-btn"
                onClick={() => onSetTargets(team)}
              >
                Set {TEAM_DEFS[team]?.label} Targets
              </button>
            </div>
          )
        })}
      </div>

      {allMonths.length > 0 && (
        <>
          {/* ── Cross-team MIS trend ── */}
          <div>
            <h3 className="manager-section-label">Cross-Team Avg MIS Trend</h3>
            <div className="tt-table-wrap">
              <table className="tt-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    {TEAM_IDS.map(t => <th key={t}>{TEAM_DEFS[t]?.label || t}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {allMonths.map(month => (
                    <tr key={month}>
                      <td>{fmtMonthFull(month)}</td>
                      {TEAM_IDS.map(t => {
                        const entry = trendData[t].find(d => d.month === month)
                        return (
                          <td key={t} className="tt-score">
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
          </div>

          {/* ── Per-team metric trends ── */}
          <div>
            <h3 className="manager-section-label">Metric Averages by Team</h3>
            <div className="manager-metric-tables">
              {TEAM_IDS.map(team => {
                const teamDef = TEAM_DEFS[team]
                const rows    = trendData[team].filter(d => allMonths.includes(d.month))
                if (!rows.length) return null
                return (
                  <div key={team} className="manager-metric-section tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th className="manager-metric-team-col">
                            <span className={`tt-team-badge tt-team-${team}`}>{teamDef.label}</span>
                          </th>
                          {teamDef.metricDefs.map(def => (
                            <th key={def.key} className="manager-metric-col">{def.label}</th>
                          ))}
                          <th className="manager-metric-col">Avg MIS</th>
                          <th className="manager-metric-col">Pass %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(entry => (
                          <tr key={entry.month}>
                            <td className="manager-metric-month">{fmtMonthFull(entry.month)}</td>
                            {teamDef.metricDefs.map(def => (
                              <td key={def.key} className="tt-score">
                                {entry.metrics?.[def.key] != null
                                  ? fmtMetric(def, entry.metrics[def.key])
                                  : <span className="tt-empty">—</span>
                                }
                              </td>
                            ))}
                            <td className="tt-score">
                              <span style={{ color: misColor(entry.avgMIS) }}>{fmtMIS(entry.avgMIS)}</span>
                            </td>
                            <td className="tt-score">{Math.round(entry.passRate * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
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
  const [newSupTeam, setNewSupTeam]       = useState('pss')
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
      await addSupervisorUser(trimmed, newSupPw, newSupTeam)
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
                <li key={u.username} className="user-list-item">
                  <span>
                    {u.username}
                    <span className="user-team-tag"> · {TEAM_DEFS[u.team]?.label ?? u.team}</span>
                  </span>
                  <button className="btn-ghost user-remove-btn" onClick={() => handleRemoveSupervisor(u.username)}>Remove</button>
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
            <label className="password-field">
              <span>Team</span>
              <select value={newSupTeam} onChange={e => setNewSupTeam(e.target.value)}>
                {Object.entries(TEAM_DEFS).map(([id, def]) => (
                  <option key={id} value={id}>{def.label}</option>
                ))}
              </select>
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
          <div className="targets-fields">
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
  return teamDef.metricDefs.map(def => {
    const { key, label, configKey, configKeyVoice, configKeyMessaging, channelSplit, tamTargets, tamTierMap } = def

    if (tamTargets && tamTierMap) {
      return (
        <div key={key} className="targets-group">
          <div className="targets-group-label">{label}</div>
          <div className="targets-group-fields">
            {Object.entries(tamTierMap).map(([tierLabel, cfgKey]) => (
              <label key={cfgKey} className="targets-field">
                <span>{tierLabel}</span>
                <input type="number" step="any"
                  value={draft[configKey]?.[cfgKey] ?? ''}
                  onChange={e => update(configKey, cfgKey, e.target.value)} />
              </label>
            ))}
          </div>
        </div>
      )
    }

    if (tamTargets) {
      return (
        <div key={key} className="targets-group">
          <div className="targets-group-label">{label}</div>
          <div className="targets-group-fields">
            <label className="targets-field">
              <span>TAM 1 &amp; 2 Target</span>
              <input type="number" step="any"
                value={draft[configKey]?.tam1_2Target ?? ''}
                onChange={e => update(configKey, 'tam1_2Target', e.target.value)} />
            </label>
            <label className="targets-field">
              <span>TAM 3 Target</span>
              <input type="number" step="any"
                value={draft[configKey]?.tam3Target ?? ''}
                onChange={e => update(configKey, 'tam3Target', e.target.value)} />
            </label>
          </div>
        </div>
      )
    }

    if (channelSplit && configKeyVoice) {
      return (
        <div key={key} className="targets-group">
          <div className="targets-group-label">{label}</div>
          {[{ lbl: 'Voice', cfgKey: configKeyVoice }, { lbl: 'Messaging', cfgKey: configKeyMessaging }].map(({ lbl, cfgKey }) => (
            <div key={cfgKey} className="targets-channel">
              <div className="targets-channel-label">{lbl}</div>
              <div className="targets-group-fields">
                {['min', 'target', 'max'].map(sub => (
                  <label key={sub} className="targets-field">
                    <span>{sub[0].toUpperCase() + sub.slice(1)}</span>
                    <input type="number" step="any"
                      value={draft[cfgKey]?.[sub] ?? ''}
                      onChange={e => update(cfgKey, sub, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }

    const hasMinMax = 'min' in (teamDef.defaultConfig[configKey] || {})
    return (
      <div key={key} className="targets-group">
        <div className="targets-group-label">{label}</div>
        <div className="targets-group-fields">
          {hasMinMax && (
            <label className="targets-field">
              <span>Min</span>
              <input type="number" step="any"
                value={draft[configKey]?.min ?? ''}
                onChange={e => update(configKey, 'min', e.target.value)} />
            </label>
          )}
          <label className="targets-field">
            <span>Target</span>
            <input type="number" step="any"
              value={draft[configKey]?.target ?? ''}
              onChange={e => update(configKey, 'target', e.target.value)} />
          </label>
          {hasMinMax && (
            <label className="targets-field">
              <span>Max</span>
              <input type="number" step="any"
                value={draft[configKey]?.max ?? ''}
                onChange={e => update(configKey, 'max', e.target.value)} />
            </label>
          )}
        </div>
      </div>
    )
  })
}
