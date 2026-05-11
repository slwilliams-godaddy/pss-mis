import { useState } from 'react'
import { calculateMIS, SCORE_RAILS } from '../utils/misCalculator'
import ScoreGauge from './ScoreGauge'
import MetricRow from './MetricRow'

// ── Math helpers ────────────────────────────────────────────────────────────

function invertPts(pts, cfg, rail) {
  if (pts >= rail.max) return cfg.max
  if (pts <= rail.min) return cfg.min
  if (pts >= 0) return (pts / rail.max) * (cfg.max - cfg.target) + cfg.target
  return cfg.target + (pts / Math.abs(rail.min)) * (cfg.target - cfg.min)
}

function computeGuidance(cpd, gcr, qa, qaCount, qaRemaining, W, R, config) {
  const current = calculateMIS({ cpd, gcr, qa }, config)
  if (R <= 0) return { current, noRemaining: true }

  const totalDays = W + R
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const ε = 0.01

  const neededRate = (finalVal, currentRate) =>
    (finalVal * totalDays - currentRate * W) / R

  const neededFutureQaAvg = (finalQa) =>
    qaRemaining > 0
      ? (finalQa * (qaCount + qaRemaining) - qa * qaCount) / qaRemaining
      : null

  const onTrackCpdPts = clamp(ε - current.gcr - current.qa, SCORE_RAILS.cpd.min, SCORE_RAILS.cpd.max)
  const onTrackGcrPts = clamp(ε - current.cpd - current.qa, SCORE_RAILS.gcr.min, SCORE_RAILS.gcr.max)
  const onTrackQaPts  = clamp(ε - current.cpd - current.gcr, SCORE_RAILS.qa.min,  SCORE_RAILS.qa.max)

  return {
    current,
    onTrack: {
      cpd:   neededRate(invertPts(onTrackCpdPts, config.cpd, SCORE_RAILS.cpd), cpd),
      gcr:   neededRate(invertPts(onTrackGcrPts, config.gcr, SCORE_RAILS.gcr), gcr),
      qaAvg: neededFutureQaAvg(invertPts(onTrackQaPts, config.qa, SCORE_RAILS.qa)),
    },
    maximize: {
      cpd:   neededRate(config.cpd.max, cpd),
      gcr:   neededRate(config.gcr.max, gcr),
      qaAvg: neededFutureQaAvg(config.qa.max),
    },
  }
}

// ── Guidance row components ──────────────────────────────────────────────────

function RateGuidanceRow({ label, current, needed, daysRemaining, prefix = '', ceiling }) {
  const fmt = v => `${prefix}${v.toFixed(2)}/day`
  let cls, msg
  if (needed <= 0) {
    cls = 'good'
    msg = `Your current pace already covers this with room to spare.`
  } else if (needed > ceiling) {
    cls = 'bad'
    msg = `Not achievable — you'd need ${fmt(needed)} but the ceiling is ${fmt(ceiling)}.`
  } else if (needed <= current + 0.005) {
    cls = 'good'
    msg = `Maintain your current pace of ${fmt(current)} — you're already on track.`
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

function QaGuidanceRow({ currentAvg, qaCount, qaRemaining, needed }) {
  let cls, msg
  if (needed === null) {
    cls = 'neutral'
    msg = `Enter expected remaining evals above to see QA guidance.`
  } else if (needed > 100) {
    cls = 'bad'
    msg = `Not achievable — your ${qaRemaining} remaining eval${qaRemaining !== 1 ? 's' : ''} would need to average ${needed.toFixed(1)}%, which exceeds 100%.`
  } else if (needed <= 0) {
    cls = 'good'
    msg = `Any average on your remaining evals will keep you covered.`
  } else {
    cls = needed > currentAvg ? 'warn' : 'good'
    msg = `Your ${qaRemaining} remaining eval${qaRemaining !== 1 ? 's' : ''} need to average ${needed.toFixed(1)}% (currently averaging ${currentAvg.toFixed(1)}%).`
  }
  return (
    <div className={`guidance-row guidance-${cls}`}>
      <span className="guidance-label">QA</span>
      <span className="guidance-text">{msg}</span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GuideView({ config }) {
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

    const mis = calculateMIS({ cpd, gcr, qa }, config)
    const g   = computeGuidance(cpd, gcr, qa, qaCt, qaRem, W, R, config)

    setUsedActuals({ cpd, gcr, qa })
    setUsedDays({ W, R })
    setUsedQa({ count: qaCt, remaining: qaRem })
    setResult(mis)
    setGuidance(g)
  }

  const handleExport = () => {
    if (!result || !usedActuals) return
    const lines = [
      'PSS Merchant Impact Score Report',
      `Month: ${config.month}`,
      `Days Worked: ${usedDays?.W ?? ''}`,
      `Days Remaining: ${usedDays?.R ?? ''}`,
      `QA Evals Received: ${usedQa?.count ?? ''}`,
      `Expected Remaining Evals: ${usedQa?.remaining ?? ''}`,
      '',
      'Metric,Actual (per day),Score',
      `CPD,${usedActuals.cpd.toFixed(2)},${result.cpd}`,
      `GCR,$${usedActuals.gcr.toFixed(2)},${result.gcr}`,
      `QA,${usedActuals.qa.toFixed(1)}%,${result.qa}`,
      '',
      `Total MIS,${result.total}`,
      `Status,${result.passing ? 'On Track' : 'Off Track'}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MIS_${config.month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="view-container">
      <h2>My MIS Calculator</h2>
      <p className="subtext">Month: <strong>{config.month}</strong></p>

      <form onSubmit={handleCalculate} className="input-form">

        {/* Row 1: Days */}
        <div className="form-grid">
          <label className="field-narrow">
            <div className="field-header"><span>Days Worked</span></div>
            <input
              type="number"
              value={daysWorked}
              onChange={e => { setDaysWorked(e.target.value); clearResult() }}
              placeholder="e.g. 15"
              min="0" step="0.5" required
            />
          </label>
          <label className="field-narrow">
            <div className="field-header"><span>Days Remaining</span></div>
            <input
              type="number"
              value={daysRemaining}
              onChange={e => { setDaysRemaining(e.target.value); clearResult() }}
              placeholder="e.g. 6"
              min="0" step="0.5" required
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
              Target: {gcrMode === 'total' && W > 0
                ? `$${(config.gcr.target * W).toFixed(0)} by now`
                : `$${config.gcr.target}/day`}
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

            <button onClick={handleExport} className="btn-secondary">Export as CSV</button>
          </div>

          {guidance?.noRemaining ? (
            <div className="guidance-card">
              <p className="subtext">No days remaining — your score is final.</p>
            </div>
          ) : guidance && (
            <div className="guidance-card">

              {/* ── To Get On Track (only if off track) ── */}
              {!result.passing && (
                <div className="guidance-section">
                  <h3 className="guidance-heading guidance-heading-warn">To Get On Track</h3>
                  <p className="guidance-intro">
                    With <strong>{usedDays.R}</strong> day{usedDays.R !== 1 ? 's' : ''} remaining,
                    here's what each metric needs — adjusting one at a time while holding the others constant:
                  </p>
                  <div className="guidance-rows">
                    <RateGuidanceRow
                      label="CPD"
                      current={usedActuals.cpd}
                      needed={guidance.onTrack.cpd}
                      daysRemaining={usedDays.R}
                      ceiling={config.cpd.max}
                    />
                    <RateGuidanceRow
                      label="GCR"
                      current={usedActuals.gcr}
                      needed={guidance.onTrack.gcr}
                      daysRemaining={usedDays.R}
                      prefix="$"
                      ceiling={config.gcr.max}
                    />
                    <QaGuidanceRow
                      currentAvg={usedActuals.qa}
                      qaCount={usedQa.count}
                      qaRemaining={usedQa.remaining}
                      needed={guidance.onTrack.qaAvg}
                    />
                  </div>
                </div>
              )}

              {/* ── To Maximize ── */}
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
                    ceiling={config.cpd.max}
                  />
                  <RateGuidanceRow
                    label="GCR"
                    current={usedActuals.gcr}
                    needed={guidance.maximize.gcr}
                    daysRemaining={usedDays.R}
                    prefix="$"
                    ceiling={config.gcr.max}
                  />
                  <QaGuidanceRow
                    currentAvg={usedActuals.qa}
                    qaCount={usedQa.count}
                    qaRemaining={usedQa.remaining}
                    needed={guidance.maximize.qaAvg}
                  />
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  )
}
