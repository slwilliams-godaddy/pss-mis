import { useState, useEffect, useMemo } from 'react'
import { calculateMISGeneric } from '../utils/misCalculator'
import { TEAM_DEFS, resolveConfigByKey } from '../utils/teamConfig'
import ScoreGauge from './ScoreGauge'
import MetricRow from './MetricRow'
import TechTitans from './TechTitans'
import { getGuideHistory, getConfigMonths, getConfigForMonth, getConfig } from '../utils/storage'

// ── Math helpers ─────────────────────────────────────────────────────────────

function neededFutureQaAvg(target, currentAvg, qaCount, qaRemaining) {
  return qaRemaining > 0
    ? (target * (qaCount + qaRemaining) - currentAvg * qaCount) / qaRemaining
    : null
}

function computeGuidance(actuals, qaCount, qaRemaining, W, R, resolvedConfig, metricDefs, teamDef) {
  const current = calculateMISGeneric(actuals, resolvedConfig, metricDefs)
  if (R <= 0) return { current, noRemaining: true }
  const totalDays = W + R
  const neededRate = (finalVal, currentRate) => (finalVal * totalDays - currentRate * W) / R
  const toTarget = {}, maximize = {}
  for (const def of metricDefs) {
    const cfg = resolvedConfig[def.configKey]
    if (!cfg) continue
    const cur = actuals[def.key] ?? 0
    const impliedMax = cfg.target != null
      ? cfg.target * (1 + def.rail.max / (100 * def.weight))
      : null
    const maxTarget = cfg.max ?? impliedMax
    if (def.entryMode === 'count') {
      toTarget[def.key] = cfg.target - cur
      maximize[def.key] = maxTarget != null ? maxTarget - cur : null
    } else if (def.entryMode === 'weighted') {
      toTarget[def.key] = neededRate(cfg.target, cur)
      maximize[def.key] = maxTarget != null ? neededRate(maxTarget, cur) : null
    } else if (def.isQuality && !teamDef.qaNotInMis) {
      toTarget[def.key] = neededFutureQaAvg(cfg.target, cur, qaCount, qaRemaining)
      maximize[def.key] = maxTarget != null ? neededFutureQaAvg(maxTarget, cur, qaCount, qaRemaining) : null
    } else {
      toTarget[def.key] = neededRate(cfg.target, cur)
      maximize[def.key] = maxTarget != null ? neededRate(maxTarget, cur) : null
    }
  }
  return { current, toTarget, maximize }
}

// ── Guidance row components ──────────────────────────────────────────────────

function GuidanceRow({ label, current, needed, daysRemaining, fmt, ceiling = Infinity, aspirational = false }) {
  const greenThreshold = aspirational ? current * 1.25 : current + 0.005
  let cls, msg
  if (needed <= 0) {
    cls = 'good'
    msg = 'Your current pace already covers this with room to spare.'
  } else if (needed > ceiling) {
    cls = 'bad'
    msg = `Not achievable — you'd need ${fmt(needed)} but the ceiling is ${fmt(ceiling)}.`
  } else if (needed <= greenThreshold) {
    cls = 'good'
    msg = aspirational && needed > current + 0.005
      ? `Need ${fmt(needed)} for the remaining ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} (currently ${fmt(current)}).`
      : `Maintain your current pace of ${fmt(current)} — you're already on track.`
  } else {
    cls = 'warn'
    msg = `Need ${fmt(needed)} for the remaining ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} (currently ${fmt(current)}).`
  }
  return (
    <div className={`guidance-row guidance-${cls}`}>
      <span className="guidance-label">{label}</span>
      <span className="guidance-text">{msg}</span>
    </div>
  )
}

function QaGuidanceRow({ label = 'QA', currentAvg, qaCount, qaRemaining, needed, qaTarget }) {
  const evalWord = `${qaRemaining} remaining eval${qaRemaining !== 1 ? 's' : ''}`
  let cls, msg
  if (needed === null) {
    cls = 'neutral'
    msg = 'Enter expected remaining evals above to see guidance.'
  } else if (needed <= 0) {
    cls = 'good'
    msg = 'Your current average already covers this with room to spare.'
  } else if (needed > 100) {
    const best = (currentAvg * qaCount + 100 * qaRemaining) / (qaCount + qaRemaining)
    if (best > qaTarget) {
      cls = 'warn'
      msg = `Can't reach the maximum from here — scoring 100% on your ${evalWord} gives a best possible average of ${best.toFixed(1)}%.`
    } else {
      cls = 'bad'
      msg = `Not achievable — even scoring 100% on your ${evalWord}, your best possible average is ${best.toFixed(1)}%, which is below the ${qaTarget}% target.`
    }
  } else if (needed <= currentAvg + 0.05) {
    cls = 'good'
    msg = `Maintain your current average of ${currentAvg.toFixed(1)}% — you're already covered.`
  } else {
    cls = 'warn'
    msg = `Need to average ${needed.toFixed(1)}% on your ${evalWord} (currently averaging ${currentAvg.toFixed(1)}%).`
  }
  return (
    <div className={`guidance-row guidance-${cls}`}>
      <span className="guidance-label">{label}</span>
      <span className="guidance-text">{msg}</span>
    </div>
  )
}

function CountGuidanceRow({ label, current, needed, aspirational = false }) {
  let cls, msg
  const remaining = Math.ceil(needed)
  if (needed <= 0) {
    cls = 'good'
    msg = aspirational
      ? `You've hit the ceiling with ${Math.round(current)} item${Math.round(current) !== 1 ? 's' : ''}.`
      : `You've already reached or exceeded the target with ${Math.round(current)} item${Math.round(current) !== 1 ? 's' : ''}.`
  } else {
    cls = aspirational ? 'warn' : 'warn'
    msg = `Need ${remaining} more item${remaining !== 1 ? 's' : ''} by end of month (currently ${Math.round(current)}).`
  }
  return (
    <div className={`guidance-row guidance-${cls}`}>
      <span className="guidance-label">{label}</span>
      <span className="guidance-text">{msg}</span>
    </div>
  )
}

// ── History panel ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const fmtMonth = (m) => { const [y, mm] = m.split('-'); return `${MONTH_NAMES[+mm - 1]} ${y}` }
const fmtSigned = (v) => { const n = parseFloat(Number(v).toFixed(2)); return (n > 0 ? '+' : '') + n }
const scoreColor = (s) => s > 0 ? '#22c55e' : s === 0 ? '#f59e0b' : '#ef4444'
const trendDelta = (arr) => arr.length >= 2 ? arr[arr.length - 1] - arr[arr.length - 2] : null

const SPARKLINE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a78bfa']

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
  if (def.entryMode === 'percent') return `${v.toFixed(1)}${def.suffix}`
  if (def.entryMode === 'count') return `${Math.round(v)}`
  return `${def.prefix || ''}${v.toFixed(2)}${def.suffix}`  // perday + weighted both show X.XX/day
}

function HistoryPanel({ guideUser, team }) {
  const teamDef = TEAM_DEFS[team] || TEAM_DEFS.pss
  const { metricDefs } = teamDef
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getGuideHistory(guideUser, team)
      .then(data => { setRows(data); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to load scores.'); setLoading(false) })
  }, [guideUser, team])

  const misVals = (rows || []).map(r => r.total)

  return (
    <div className="trend-tab">
      {loading && <p className="subtext">Loading…</p>}
      {error && <p className="gate-error">{error}</p>}

      {!loading && rows !== null && rows.length === 0 && (
        <p className="subtext">No published scores found yet. Check back once your supervisor has published results.</p>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="trend-cards">
            {metricDefs.map((def, i) => {
              const color = SPARKLINE_COLORS[i % SPARKLINE_COLORS.length]
              const ptsVals = rows.map(r => r[def.key])
              const actualVals = rows.map(r => r.actuals[def.key])
              const d = trendDelta(actualVals)
              const dPts = trendDelta(ptsVals)
              const latest = actualVals[actualVals.length - 1]
              const latestPts = ptsVals[ptsVals.length - 1]
              return (
                <div key={def.key} className="trend-card">
                  <span className="trend-card-label">{def.label}</span>
                  <Sparkline values={ptsVals} color={color} />
                  <div className="trend-card-footer">
                    <span className="trend-card-latest" style={{ color }}>{fmtActual(def, latest)}</span>
                    {d != null && (
                      <span className="trend-delta" style={{ color: d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#f59e0b' }}>
                        {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {fmtActual(def, Math.abs(d))}
                      </span>
                    )}
                  </div>
                  <div className="trend-card-pts">
                    <span className="trend-card-pts-val" style={{ color: scoreColor(latestPts) }}>
                      {fmtSigned(latestPts)} pts
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
              const d = trendDelta(misVals)
              const latest = misVals[misVals.length - 1]
              return (
                <div className="trend-card">
                  <span className="trend-card-label">Total MIS</span>
                  <Sparkline values={misVals} color={scoreColor(latest)} />
                  <div className="trend-card-footer">
                    <span className="trend-card-latest" style={{ color: scoreColor(latest) }}>{fmtSigned(latest)}</span>
                    {d != null && (
                      <span className="trend-delta" style={{ color: d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#f59e0b' }}>
                        {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {parseFloat(Math.abs(d).toFixed(2))}
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
                <th>Total MIS</th><th>Uncapped</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
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
                  <td className="history-uncapped" style={{ color: scoreColor(r.unboundedTotal) }}>{fmtSigned(r.unboundedTotal)}</td>
                  <td><span className={`pass-badge small ${r.passing ? 'pass' : 'fail'}`}>{r.passing ? 'On Track' : 'Off Track'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GuideView({ team, guideUser }) {
  const teamDef = TEAM_DEFS[team] || TEAM_DEFS.pss
  const { metricDefs } = teamDef
  const tamRoleOptions = (() => {
    const tierMap = metricDefs.find(def => def.tamTargets)?.tamTierMap
    return tierMap ? Object.keys(tierMap) : []
  })()

  const [activeTab, setActiveTab] = useState('calculator')

  // Config — fetched on mount; not passed as prop
  const [config, setConfig] = useState(null)
  const [configMonths, setConfigMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [activeConfig, setActiveConfig] = useState(null)

  useEffect(() => {
    getConfig(team).then(cfg => {
      setConfig(cfg); setActiveConfig(cfg); setSelectedMonth(cfg.month)
    }).catch(() => {})
    getConfigMonths(team).then(setConfigMonths).catch(() => {})
  }, [team])

  useEffect(() => {
    if (!selectedMonth || !config) return
    if (selectedMonth === config.month) { setActiveConfig(config); return }
    getConfigForMonth(selectedMonth, team).then(cfg => { if (cfg) setActiveConfig(cfg) }).catch(() => {})
  }, [selectedMonth, config, team])

  const initFields = (defs) => {
    const f = {}
    for (const d of defs) {
      if (d.entryMode === 'weighted') {
        for (const comp of d.weightedComponents) f[comp.key] = ''
      } else {
        f[d.key] = ''
      }
    }
    return f
  }
  const initModes  = (defs) => Object.fromEntries(defs.filter(d => d.entryMode === 'perday').map(d => [d.key, 'perday']))

  const [fields, setFields]         = useState(() => initFields(metricDefs))
  const [fieldModes, setFieldModes] = useState(() => initModes(metricDefs))
  const [channel, setChannel]       = useState('voice')
  const [tamRole, setTamRole]       = useState(() => tamRoleOptions[0] ?? 'TAM 1')
  const [daysWorked, setDaysWorked]         = useState('')
  const [daysRemaining, setDaysRemaining]   = useState('')
  const [qaCount, setQaCount]               = useState('')
  const [qaRemainingEvals, setQaRemainingEvals] = useState('')
  const [result, setResult]     = useState(null)
  const [guidance, setGuidance] = useState(null)
  const [snapshot, setSnapshot] = useState(null) // frozen actuals + context at calculation time

  // Reset field state on team change
  useEffect(() => {
    setFields(initFields(metricDefs))
    setFieldModes(initModes(metricDefs))
    setResult(null); setGuidance(null); setSnapshot(null)
  }, [team])

  const W = parseFloat(daysWorked)
  const R = parseFloat(daysRemaining)

  const clearResult = () => { setResult(null); setGuidance(null); setSnapshot(null) }

  const resolvedConfig = useMemo(() => {
    if (!activeConfig) return {}
    return resolveConfigByKey(metricDefs, activeConfig, channel, tamRole)
  }, [activeConfig, channel, tamRole, metricDefs])

  const qualityDef = metricDefs.find(d => d.isQuality)

  const handleCalculate = (e) => {
    e.preventDefault()
    if (isNaN(W) || W <= 0) return
    if (isNaN(R) || R < 0) return

    const actuals = {}
    for (const def of metricDefs) {
      if (def.entryMode === 'weighted') {
        let weighted = 0
        for (const comp of def.weightedComponents) {
          const v = parseFloat(fields[comp.key])
          if (isNaN(v)) return
          weighted += v * comp.multiplier
        }
        actuals[def.key] = weighted / W
      } else {
        const raw = def.entryMode === 'perday' && fieldModes[def.key] === 'total'
          ? parseFloat(fields[def.key]) / W
          : parseFloat(fields[def.key])
        if (isNaN(raw)) return
        actuals[def.key] = raw
      }
    }

    const qaCt  = parseInt(qaCount) || 0
    const qaRem = parseInt(qaRemainingEvals) || 0

    const mis = calculateMISGeneric(actuals, resolvedConfig, metricDefs)
    const g   = computeGuidance(actuals, qaCt, qaRem, W, R, resolvedConfig, metricDefs, teamDef)

    setResult(mis)
    setGuidance(g)
    setSnapshot({ actuals, W, R, qaCount: qaCt, qaRemaining: qaRem })
  }

  const hasMaximize = result && guidance?.maximize
    && Object.values(guidance.maximize).some(v => v !== null)

  const guidanceFmt = (def) => (def.entryMode === 'perday' || def.entryMode === 'weighted')
    ? (v) => `${def.prefix || ''}${v.toFixed(2)}${def.suffix}`
    : (v) => `${v.toFixed(1)}${def.suffix}`

  const targetHint = (def, mode) => {
    const cfg = resolvedConfig[def.configKey]
    if (!cfg) return null
    if (def.entryMode === 'perday' && mode === 'total' && W > 0) {
      return `${def.prefix || ''}${(cfg.target * W).toFixed(0)} by now`
    }
    if (def.entryMode === 'weighted') return `${cfg.target}${def.suffix}`
    return `${def.prefix || ''}${cfg.target}${def.suffix}`
  }

  const nonQualityDefs = metricDefs.filter(d => !d.isQuality)

  return (
    <div className="view-container">
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'calculator' ? 'active' : ''}`} onClick={() => setActiveTab('calculator')}>
          Pacing Calculator
        </button>
        <button className={`tab-btn ${activeTab === 'lookup' ? 'active' : ''}`} onClick={() => setActiveTab('lookup')}>
          History
        </button>
        <button className={`tab-btn ${activeTab === 'titans' ? 'active' : ''}`} onClick={() => setActiveTab('titans')}>
          Tech Titans
        </button>
      </div>

      {activeTab === 'titans' && <TechTitans guideUser={guideUser} anonymize />}
      {activeTab === 'lookup' && <HistoryPanel guideUser={guideUser} team={team} />}

      {activeTab === 'calculator' && (
        <>
          <div className="calc-month-select">
            <span className="subtext">Month</span>
            <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); clearResult() }}>
              {configMonths.length === 0 && config?.month && (
                <option value={config.month}>{fmtMonth(config.month)}</option>
              )}
              {configMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
          </div>

          <form onSubmit={handleCalculate} className="input-form">

            {/* Channel toggle — PSS only */}
            {teamDef.hasChannel && (
              <div className="guide-channel-row">
                <span className="guide-channel-label">Channel</span>
                <div className="inline-toggle">
                  <button type="button" className={`toggle-btn ${channel === 'voice' ? 'active' : ''}`} onClick={() => { setChannel('voice'); clearResult() }}>Voice</button>
                  <button type="button" className={`toggle-btn ${channel === 'messaging' ? 'active' : ''}`} onClick={() => { setChannel('messaging'); clearResult() }}>Messaging</button>
                </div>
              </div>
            )}

            {/* TAM Role selector */}
            {tamRoleOptions.length > 0 && (
              <div className="guide-channel-row">
                <span className="guide-channel-label">Level</span>
                <select value={tamRole} onChange={e => { setTamRole(e.target.value); clearResult() }}>
                  {tamRoleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            {/* Days row */}
            <div className="form-grid">
              <label className="field-narrow">
                <div className="field-header"><span>Days Worked</span></div>
                <input
                  type="number" value={daysWorked}
                  onChange={e => { setDaysWorked(e.target.value); clearResult() }}
                  placeholder="e.g. 15" min="0" step="0.1" required
                />
              </label>
              <label className="field-narrow">
                <div className="field-header"><span>Days Remaining</span></div>
                <input
                  type="number" value={daysRemaining}
                  onChange={e => { setDaysRemaining(e.target.value); clearResult() }}
                  placeholder="e.g. 6" min="0" step="0.1" required
                />
              </label>
              <div className="field-days-total">
                {W > 0 && R >= 0 && !isNaN(W) && !isNaN(R) && (
                  <span className="subtext">{W + R} total days</span>
                )}
              </div>
            </div>

            {/* Non-quality metric fields */}
            <div className="form-grid">
              {nonQualityDefs.map(def => {
                const mode = fieldModes[def.key]
                const isTotal = mode === 'total'
                const computed = isTotal && fields[def.key] && W > 0
                  ? (parseFloat(fields[def.key]) / W).toFixed(2) : null
                if (def.entryMode === 'weighted') {
                  let weighted = 0
                  let allFilled = true
                  for (const comp of def.weightedComponents) {
                    const v = parseFloat(fields[comp.key])
                    if (isNaN(v)) { allFilled = false; break }
                    weighted += v * comp.multiplier
                  }
                  const ccpd = allFilled && W > 0 ? (weighted / W).toFixed(2) : null
                  const cfg = resolvedConfig[def.configKey]
                  return (
                    <div key={def.key} className="weighted-field-group">
                      <div className="field-header"><span>{def.fullName}</span></div>
                      <div className="weighted-inputs">
                        {def.weightedComponents.map(comp => (
                          <label key={comp.key} className="weighted-sub">
                            <input
                              type="number"
                              value={fields[comp.key]}
                              onChange={e => { setFields(f => ({ ...f, [comp.key]: e.target.value })); clearResult() }}
                              placeholder={`${comp.label} Closures`}
                              step="1"
                              min="0"
                              required
                            />
                          </label>
                        ))}
                      </div>
                      {ccpd && (
                        <span className="computed-hint">
                          = {ccpd}/day
                          {cfg?.target ? ` (target: ${cfg.target}/day)` : ''}
                        </span>
                      )}
                      {!ccpd && cfg?.target && (
                        <span className="target-hint">Target: {cfg.target}/day</span>
                      )}
                    </div>
                  )
                }
                if (def.entryMode === 'count') {
                  return (
                    <label key={def.key}>
                      <div className="field-header"><span>{def.fullName}</span></div>
                      <input
                        type="number"
                        name={def.key}
                        value={fields[def.key]}
                        onChange={e => { setFields(f => ({ ...f, [def.key]: e.target.value })); clearResult() }}
                        placeholder={def.label}
                        step="1"
                        min="0"
                        required
                      />
                      <span className="target-hint">Target: {targetHint(def, mode)}/month</span>
                    </label>
                  )
                }
                return (
                  <label key={def.key}>
                    <div className="field-header spaced">
                      <span>{isTotal ? `Total ${def.fullName} So Far` : def.fullName}</span>
                      {def.entryMode === 'perday' && (
                        <div className="inline-toggle">
                          <button type="button" className={`toggle-btn ${!isTotal ? 'active' : ''}`}
                            onClick={() => { setFieldModes(m => ({ ...m, [def.key]: 'perday' })); setFields(f => ({ ...f, [def.key]: '' })); clearResult() }}>
                            Per Day
                          </button>
                          <button type="button" className={`toggle-btn ${isTotal ? 'active' : ''}`}
                            onClick={() => { setFieldModes(m => ({ ...m, [def.key]: 'total' })); setFields(f => ({ ...f, [def.key]: '' })); clearResult() }}>
                            Total So Far
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      name={def.key}
                      value={fields[def.key]}
                      onChange={e => { setFields(f => ({ ...f, [def.key]: e.target.value })); clearResult() }}
                      placeholder={isTotal ? `Total so far` : def.label}
                      step="0.01"
                      min={def.entryMode === 'percent' ? '0' : undefined}
                      max={def.maxEntry != null ? String(def.maxEntry) : undefined}
                      required
                    />
                    <span className="target-hint">{targetHint(def, mode)}</span>
                    {computed && <span className="computed-hint">= {def.prefix || ''}{computed}{def.suffix}</span>}
                  </label>
                )
              })}
            </div>

            {/* Quality metric (QA / AQI) + evals — hidden for qaNotInMis teams */}
            {qualityDef && !teamDef.qaNotInMis && (
              <div className="qa-fields">
                <label>
                  <div className="field-header"><span>{qualityDef.label} Average</span></div>
                  <input
                    type="number"
                    value={fields[qualityDef.key]}
                    onChange={e => { setFields(f => ({ ...f, [qualityDef.key]: e.target.value })); clearResult() }}
                    placeholder={`Current ${qualityDef.label} avg`}
                    step="0.01" min="0" max="100" required
                  />
                  <span className="target-hint">
                    {resolvedConfig[qualityDef.configKey] && `Target: ${resolvedConfig[qualityDef.configKey].target}${qualityDef.suffix}`}
                  </span>
                </label>
                <label className="field-narrow">
                  <div className="field-header"><span>Evals Received</span></div>
                  <input
                    type="number" value={qaCount}
                    onChange={e => { setQaCount(e.target.value); clearResult() }}
                    placeholder="e.g. 3" min="0" step="1"
                  />
                  {parseInt(qaCount) > 0 && parseInt(qaCount) < 4 && (
                    <span className="warn-hint">Min 4 required</span>
                  )}
                </label>
                <label className="field-narrow">
                  <div className="field-header"><span>Expected Remaining</span></div>
                  <input
                    type="number" value={qaRemainingEvals}
                    onChange={e => { setQaRemainingEvals(e.target.value); clearResult() }}
                    placeholder="e.g. 1" min="0" step="1"
                  />
                  <span className="target-hint">For guidance</span>
                </label>
              </div>
            )}

            <button type="submit" className="btn-primary">Calculate My Score</button>
          </form>

          {result && (
            <>
              <div className="results-card">
                <div className={`pass-badge ${result.passing ? 'pass' : 'fail'}`}>
                  {result.passing ? 'On Track' : 'Off Track'}
                </div>
                <div className="total-score">{result.total > 0 ? `+${result.total}` : result.total}</div>
                <div className="total-label">Total MIS Score</div>
                {result.autoFail && (
                  <div className="autofail-note">
                    Auto-fail — {result.autoFailMetrics.map(k => {
                      const def = metricDefs.find(d => d.key === k)
                      return def?.label ?? k
                    }).join(', ')} scored worse than −25 before capping
                  </div>
                )}
                <ScoreGauge score={result.total} />

                <div className="metric-breakdown">
                  <h3>Score Breakdown</h3>
                  {metricDefs.map(def => (
                    <MetricRow key={def.key} label={def.label} score={result[def.key]} railMin={def.rail.min} railMax={def.rail.max} />
                  ))}
                </div>
              </div>

              {guidance?.noRemaining ? (
                <div className="guidance-card">
                  <p className="subtext">No days remaining — your score is final.</p>
                </div>
              ) : guidance && (
                <div className="guidance-card">

                  {metricDefs.some(def => result[def.key] < 0) && (
                    <div className="guidance-section">
                      <h3 className="guidance-heading guidance-heading-warn">To Get On Track</h3>
                      <p className="guidance-intro">
                        With <strong>{snapshot.R}</strong> day{snapshot.R !== 1 ? 's' : ''} remaining,
                        here's what each metric needs to reach its target:
                      </p>
                      <div className="guidance-rows">
                        {metricDefs.map(def => {
                          if (def.entryMode === 'count') {
                            return (
                              <CountGuidanceRow
                                key={def.key}
                                label={def.label}
                                current={snapshot.actuals[def.key]}
                                needed={guidance.toTarget[def.key]}
                              />
                            )
                          }
                          if (def.isQuality && !teamDef.qaNotInMis) {
                            return (
                              <QaGuidanceRow
                                key={def.key}
                                label={def.label}
                                currentAvg={snapshot.actuals[def.key]}
                                qaCount={snapshot.qaCount}
                                qaRemaining={snapshot.qaRemaining}
                                needed={guidance.toTarget[def.key]}
                                qaTarget={resolvedConfig[def.configKey]?.target}
                              />
                            )
                          }
                          return (
                            <GuidanceRow
                              key={def.key}
                              label={def.label}
                              current={snapshot.actuals[def.key]}
                              needed={guidance.toTarget[def.key]}
                              daysRemaining={snapshot.R}
                              fmt={guidanceFmt(def)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {hasMaximize && (
                    <div className="guidance-section">
                      <h3 className="guidance-heading guidance-heading-good">
                        {result.passing ? 'To Maximize Your Score' : 'To Reach Your Maximum'}
                      </h3>
                      <p className="guidance-intro">
                        {result.passing
                          ? `You're On Track. Here's what each metric needs for the remaining ${snapshot.R} day${snapshot.R !== 1 ? 's' : ''} to hit its ceiling:`
                          : `If you can push past the target, here's what it takes to cap out each metric:`
                        }
                      </p>
                      <div className="guidance-rows">
                        {metricDefs.map(def => {
                          const maxVal = guidance.maximize[def.key]
                          if (maxVal === null || maxVal === undefined) return null
                          if (def.entryMode === 'count') {
                            return (
                              <CountGuidanceRow
                                key={def.key}
                                label={def.label}
                                current={snapshot.actuals[def.key]}
                                needed={maxVal}
                                aspirational
                              />
                            )
                          }
                          if (def.isQuality && !teamDef.qaNotInMis) {
                            return (
                              <QaGuidanceRow
                                key={def.key}
                                label={def.label}
                                currentAvg={snapshot.actuals[def.key]}
                                qaCount={snapshot.qaCount}
                                qaRemaining={snapshot.qaRemaining}
                                needed={maxVal}
                                qaTarget={resolvedConfig[def.configKey]?.target}
                              />
                            )
                          }
                          return (
                            <GuidanceRow
                              key={def.key}
                              label={def.label}
                              current={snapshot.actuals[def.key]}
                              needed={maxVal}
                              daysRemaining={snapshot.R}
                              fmt={guidanceFmt(def)}
                              ceiling={def.maxEntry ?? Infinity}
                              aspirational
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
