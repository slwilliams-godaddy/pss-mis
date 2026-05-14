import { useState } from 'react'
import { calculateMIS, SCORE_RAILS } from '../utils/misCalculator'
import ScoreGauge from './ScoreGauge'
import MetricRow from './MetricRow'
import { getGuideHistory } from '../utils/storage'

// ── Math helpers ────────────────────────────────────────────────────────────

function computeGuidance(cpd, gcr, qa, qaCount, qaRemaining, W, R, config) {
  const current = calculateMIS({ cpd, gcr, qa }, config)
  if (R <= 0) return { current, noRemaining: true }

  const totalDays = W + R

  const neededRate = (finalVal, currentRate) =>
    (finalVal * totalDays - currentRate * W) / R

  const neededFutureQaAvg = (finalQa) =>
    qaRemaining > 0
      ? (finalQa * (qaCount + qaRemaining) - qa * qaCount) / qaRemaining
      : null

  return {
    current,
    toTarget: {
      cpd:   neededRate(config.cpd.target, cpd),
      gcr:   neededRate(config.gcr.target, gcr),
      qaAvg: neededFutureQaAvg(config.qa.target),
    },
    maximize: {
      cpd:   neededRate(config.cpd.max, cpd),
      gcr:   neededRate(config.gcr.max, gcr),
      qaAvg: neededFutureQaAvg(config.qa.max),
    },
  }
}

// ── Guidance row components ──────────────────────────────────────────────────

function RateGuidanceRow({ label, current, needed, daysRemaining, prefix = '', ceiling, aspirational = false }) {
  const fmt = v => `${prefix}${v.toFixed(2)}/day`
  const fmtTotal = v => prefix ? `${prefix}${Math.round(v)}` : `${Math.ceil(v)}`
  const greenThreshold = aspirational ? current * 1.25 : current + 0.005
  let cls, msg
  if (needed <= 0) {
    cls = 'good'
    msg = `Your current pace already covers this with room to spare.`
  } else if (needed > ceiling) {
    cls = 'bad'
    msg = `Not achievable — you'd need ${fmt(needed)} but the ceiling is ${fmt(ceiling)}.`
  } else if (needed <= greenThreshold) {
    cls = 'good'
    msg = aspirational && needed > current + 0.005
      ? `Need ${fmt(needed)} for the remaining ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} — ${fmtTotal(needed * daysRemaining)} total (currently ${fmt(current)}).`
      : `Maintain your current pace of ${fmt(current)} — you're already on track.`
  } else {
    cls = 'warn'
    msg = `Need ${fmt(needed)} for the remaining ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} — ${fmtTotal(needed * daysRemaining)} total (currently ${fmt(current)}).`
  }
  return (
    <div className={`guidance-row guidance-${cls}`}>
      <span className="guidance-label">{label}</span>
      <span className="guidance-text">{msg}</span>
    </div>
  )
}

function QaGuidanceRow({ currentAvg, qaCount, qaRemaining, needed, qaTarget }) {
  const evalWord = `${qaRemaining} remaining eval${qaRemaining !== 1 ? 's' : ''}`
  let cls, msg
  if (needed === null) {
    cls = 'neutral'
    msg = `Enter expected remaining evals above to see QA guidance.`
  } else if (needed <= 0) {
    cls = 'good'
    msg = `Your current QA average already covers this with room to spare.`
  } else if (needed > 100) {
    const best = (currentAvg * qaCount + 100 * qaRemaining) / (qaCount + qaRemaining)
    if (best > qaTarget) {
      cls = 'warn'
      msg = `Can't reach the maximum from here — scoring 100% on your ${evalWord} gives a best possible average of ${best.toFixed(1)}%.`
    } else {
      cls = 'bad'
      msg = `Not achievable — even scoring 100% on your ${evalWord}, your best possible QA average is ${best.toFixed(1)}%, which is below the ${qaTarget}% target.`
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
      <span className="guidance-label">QA</span>
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

function HistoryPanel() {
  const [email, setEmail] = useState('')
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLookup = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await getGuideHistory(email)
      setRows(data)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const cpdPts  = (rows || []).map(r => r.cpd)
  const gcrPts  = (rows || []).map(r => r.gcr)
  const qaPts   = (rows || []).map(r => r.qa)
  const cpdVals = (rows || []).map(r => r.actuals.cpd)
  const gcrVals = (rows || []).map(r => r.actuals.gcr)
  const qaVals  = (rows || []).map(r => r.actuals.qa)
  const misVals = (rows || []).map(r => r.total)

  return (
    <div className="trend-tab">
      <div className="trend-guide-select">
        <span className="trend-label">Work email</span>
        <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setRows(null); setError('') }}
            placeholder="you@example.com"
            required
            disabled={loading}
            style={{ flex: '1', minWidth: '180px' }}
          />
          <button type="submit" className="btn-secondary" disabled={loading}>
            {loading ? 'Loading…' : 'Load History'}
          </button>
        </form>
      </div>

      {error && <p className="gate-error">{error}</p>}

      {rows !== null && rows.length === 0 && (
        <p className="subtext">No published scores found for <strong>{email}</strong>. Check back once your supervisor has published results.</p>
      )}

      {rows && rows.length > 0 && (
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
              {rows.map(r => (
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
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GuideView({ config }) {
  const [activeTab, setActiveTab] = useState('calculator')
  const [cpdMode, setCpdMode] = useState('perday')
  const [gcrMode, setGcrMode] = useState('perday')
  const [fields, setFields] = useState({ cpd: '', gcr: '', qa: '' })
  const [daysWorked, setDaysWorked] = useState('')
  const [daysRemaining, setDaysRemaining] = useState('')
  const [qaCount, setQaCount] = useState('')
  const [qaRemainingEvals, setQaRemainingEvals] = useState('')
  const [result, setResult] = useState(null)
  const [guidance, setGuidance] = useState(null)
  const [usedActuals, setUsedActuals] = useState(null)
  const [usedDays, setUsedDays] = useState(null)
  const [usedQa, setUsedQa] = useState(null)
  const [channel, setChannel] = useState('voice')

  const W = parseFloat(daysWorked)
  const R = parseFloat(daysRemaining)

  const clearResult = () => { setResult(null); setGuidance(null) }

  const handleChange = (e) => {
    setFields({ ...fields, [e.target.name]: e.target.value })
    clearResult()
  }

  const switchMode = (metric, mode) => {
    if (metric === 'cpd') setCpdMode(mode)
    else setGcrMode(mode)
    setFields(f => ({ ...f, [metric]: '' }))
    clearResult()
  }

  const computedCPD = cpdMode === 'total' && fields.cpd && W > 0
    ? (parseFloat(fields.cpd) / W).toFixed(2) : null
  const computedGCR = gcrMode === 'total' && fields.gcr && W > 0
    ? (parseFloat(fields.gcr) / W).toFixed(2) : null

  const handleCalculate = (e) => {
    e.preventDefault()
    if (isNaN(W) || W <= 0) return
    if (isNaN(R) || R < 0) return

    const cpd = cpdMode === 'total' ? parseFloat(fields.cpd) / W : parseFloat(fields.cpd)
    const gcr = gcrMode === 'total' ? parseFloat(fields.gcr) / W : parseFloat(fields.gcr)
    const qa  = parseFloat(fields.qa)
    if ([cpd, gcr, qa].some(isNaN)) return

    const qaCt  = parseInt(qaCount) || 0
    const qaRem = parseInt(qaRemainingEvals) || 0

    const gcrConfig = channel === 'messaging' ? config.gcrMessaging : config.gcrVoice
    const effectiveConfig = { ...config, gcr: gcrConfig }
    const mis = calculateMIS({ cpd, gcr, qa }, effectiveConfig)
    const g   = computeGuidance(cpd, gcr, qa, qaCt, qaRem, W, R, effectiveConfig)

    setUsedActuals({ cpd, gcr, qa })
    setUsedDays({ W, R })
    setUsedQa({ count: qaCt, remaining: qaRem })
    setResult(mis)
    setGuidance(g)
  }

  return (
    <div className="view-container">
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'calculator' ? 'active' : ''}`} onClick={() => setActiveTab('calculator')}>
          Pacing Calculator
        </button>
        <button className={`tab-btn ${activeTab === 'lookup' ? 'active' : ''}`} onClick={() => setActiveTab('lookup')}>
          History
        </button>
      </div>

      {activeTab === 'lookup' && <HistoryPanel />}

      {activeTab === 'calculator' && (
        <>
          <h2>My MIS Calculator</h2>
          <p className="subtext">Month: <strong>{config?.month}</strong></p>

          <form onSubmit={handleCalculate} className="input-form">

            {/* Row 0: Channel */}
            <div className="guide-channel-row">
              <span className="guide-channel-label">Channel</span>
              <div className="inline-toggle">
                <button type="button" className={`toggle-btn ${channel === 'voice' ? 'active' : ''}`} onClick={() => { setChannel('voice'); clearResult() }}>Voice</button>
                <button type="button" className={`toggle-btn ${channel === 'messaging' ? 'active' : ''}`} onClick={() => { setChannel('messaging'); clearResult() }}>Messaging</button>
              </div>
            </div>

            {/* Row 1: Days */}
            <div className="form-grid">
              <label className="field-narrow">
                <div className="field-header"><span>Days Worked</span></div>
                <input
                  type="number"
                  value={daysWorked}
                  onChange={e => { setDaysWorked(e.target.value); clearResult() }}
                  placeholder="e.g. 15"
                  min="0" step="0.1" required
                />
              </label>
              <label className="field-narrow">
                <div className="field-header"><span>Days Remaining</span></div>
                <input
                  type="number"
                  value={daysRemaining}
                  onChange={e => { setDaysRemaining(e.target.value); clearResult() }}
                  placeholder="e.g. 6"
                  min="0" step="0.1" required
                />
              </label>
              <div className="field-days-total">
                {W > 0 && R >= 0 && !isNaN(W) && !isNaN(R) && (
                  <span className="subtext">{W + R} total days</span>
                )}
              </div>
            </div>

            {/* Row 2: CPD + GCR */}
            <div className="form-grid">
              <label>
                <div className="field-header spaced">
                  <span>{cpdMode === 'total' ? 'Total Contacts So Far' : 'CPD (Contacts Per Day)'}</span>
                  <div className="inline-toggle">
                    <button type="button" className={`toggle-btn ${cpdMode === 'perday' ? 'active' : ''}`} onClick={() => switchMode('cpd', 'perday')}>Per Day</button>
                    <button type="button" className={`toggle-btn ${cpdMode === 'total' ? 'active' : ''}`} onClick={() => switchMode('cpd', 'total')}>Total So Far</button>
                  </div>
                </div>
                <input
                  type="number" name="cpd" value={fields.cpd} onChange={handleChange}
                  placeholder={cpdMode === 'total' ? 'Total contacts so far' : 'Contacts per day'}
                  step="0.01" required
                />
                <span className="target-hint">
                  Target: {cpdMode === 'total' && W > 0
                    ? `${(config.cpd.target * W).toFixed(0)} contacts by now`
                    : `${config.cpd.target}/day`}
                </span>
                {computedCPD && <span className="computed-hint">= {computedCPD} contacts/day</span>}
              </label>

              <label>
                <div className="field-header spaced">
                  <span>{gcrMode === 'total' ? 'Total GCR So Far ($)' : 'GCR (Gross Cash Revenue Per Day)'}</span>
                  <div className="inline-toggle">
                    <button type="button" className={`toggle-btn ${gcrMode === 'perday' ? 'active' : ''}`} onClick={() => switchMode('gcr', 'perday')}>Per Day</button>
                    <button type="button" className={`toggle-btn ${gcrMode === 'total' ? 'active' : ''}`} onClick={() => switchMode('gcr', 'total')}>Total So Far</button>
                  </div>
                </div>
                <input
                  type="number" name="gcr" value={fields.gcr} onChange={handleChange}
                  placeholder={gcrMode === 'total' ? 'Total GCR so far ($)' : 'GCR per day ($)'}
                  step="0.01" required
                />
                <span className="target-hint">
                  {(() => {
                    const gcrCfg = channel === 'messaging' ? config.gcrMessaging : config.gcrVoice
                    return gcrMode === 'total' && W > 0
                      ? `Target: $${(gcrCfg.target * W).toFixed(0)} by now`
                      : `Target: $${gcrCfg.target}/day`
                  })()}
                </span>
                {computedGCR && <span className="computed-hint">= ${computedGCR}/day</span>}
              </label>
            </div>

            {/* Row 3: QA */}
            <div className="qa-fields">
              <label>
                <div className="field-header"><span>QA Average</span></div>
                <input
                  type="number" name="qa" value={fields.qa} onChange={handleChange}
                  placeholder="Current QA avg" step="0.01" min="0" max="100" required
                />
                <span className="target-hint">Target: {config.qa.target}%</span>
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
                <ScoreGauge score={result.total} />

                <div className="metric-breakdown">
                  <h3>Score Breakdown</h3>
                  <MetricRow label="CPD" score={result.cpd} railMin={SCORE_RAILS.cpd.min} railMax={SCORE_RAILS.cpd.max} />
                  <MetricRow label="GCR" score={result.gcr} railMin={SCORE_RAILS.gcr.min} railMax={SCORE_RAILS.gcr.max} />
                  <MetricRow label="QA"  score={result.qa}  railMin={SCORE_RAILS.qa.min}  railMax={SCORE_RAILS.qa.max}  />
                </div>

              </div>

              {guidance?.noRemaining ? (
                <div className="guidance-card">
                  <p className="subtext">No days remaining — your score is final.</p>
                </div>
              ) : guidance && (
                <div className="guidance-card">

                  {(result.cpd < 0 || result.gcr < 0 || result.qa < 0) && (
                    <div className="guidance-section">
                      <h3 className="guidance-heading guidance-heading-warn">To Get On Track</h3>
                      <p className="guidance-intro">
                        With <strong>{usedDays.R}</strong> day{usedDays.R !== 1 ? 's' : ''} remaining,
                        here's what each metric needs to reach its target:
                      </p>
                      <div className="guidance-rows">
                        <RateGuidanceRow
                          label="CPD"
                          current={usedActuals.cpd}
                          needed={guidance.toTarget.cpd}
                          daysRemaining={usedDays.R}
                          ceiling={Infinity}
                        />
                        <RateGuidanceRow
                          label="GCR"
                          current={usedActuals.gcr}
                          needed={guidance.toTarget.gcr}
                          daysRemaining={usedDays.R}
                          prefix="$"
                          ceiling={Infinity}
                        />
                        <QaGuidanceRow
                          currentAvg={usedActuals.qa}
                          qaCount={usedQa.count}
                          qaRemaining={usedQa.remaining}
                          needed={guidance.toTarget.qaAvg}
                          qaTarget={config.qa.target}
                        />
                      </div>
                    </div>
                  )}

                  <div className="guidance-section">
                    <h3 className="guidance-heading guidance-heading-good">
                      {result.passing ? 'To Maximize Your Score' : 'To Reach Your Maximum'}
                    </h3>
                    <p className="guidance-intro">
                      {result.passing
                        ? `You're On Track. Here's what each metric needs for the remaining ${usedDays.R} day${usedDays.R !== 1 ? 's' : ''} to hit its ceiling:`
                        : `If you can push past the target, here's what it takes to cap out each metric:`
                      }
                    </p>
                    <div className="guidance-rows">
                      <RateGuidanceRow
                        label="CPD"
                        current={usedActuals.cpd}
                        needed={guidance.maximize.cpd}
                        daysRemaining={usedDays.R}
                        ceiling={Infinity}
                        aspirational
                      />
                      <RateGuidanceRow
                        label="GCR"
                        current={usedActuals.gcr}
                        needed={guidance.maximize.gcr}
                        daysRemaining={usedDays.R}
                        prefix="$"
                        ceiling={Infinity}
                        aspirational
                      />
                      <QaGuidanceRow
                        currentAvg={usedActuals.qa}
                        qaCount={usedQa.count}
                        qaRemaining={usedQa.remaining}
                        needed={guidance.maximize.qaAvg}
                        qaTarget={config.qa.target}
                      />
                    </div>
                  </div>

                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
