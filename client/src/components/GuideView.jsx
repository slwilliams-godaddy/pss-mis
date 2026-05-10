import { useState } from 'react'
import { calculateMIS, SCORE_RAILS } from '../utils/misCalculator'
import ScoreGauge from './ScoreGauge'
import MetricRow from './MetricRow'

export default function GuideView({ config }) {
  const [cpdMode, setCpdMode] = useState('perday')
  const [gcrMode, setGcrMode] = useState('perday')
  const [fields, setFields] = useState({ cpd: '', gcr: '', qa: '', days: '' })
  const [result, setResult] = useState(null)
  const [usedActuals, setUsedActuals] = useState(null)

  const needsDays = cpdMode === 'total' || gcrMode === 'total'

  const handleChange = (e) => {
    setFields({ ...fields, [e.target.name]: e.target.value })
    setResult(null)
  }

  const switchMode = (metric, mode) => {
    if (metric === 'cpd') setCpdMode(mode)
    else setGcrMode(mode)
    setFields(f => ({ ...f, [metric]: '' }))
    setResult(null)
  }

  const handleCalculate = (e) => {
    e.preventDefault()
    const days = parseFloat(fields.days)
    const cpd = cpdMode === 'total' ? parseFloat(fields.cpd) / days : parseFloat(fields.cpd)
    const gcr = gcrMode === 'total' ? parseFloat(fields.gcr) / days : parseFloat(fields.gcr)
    const actuals = { cpd, gcr, qa: parseFloat(fields.qa) }
    if (Object.values(actuals).some(isNaN)) return
    setUsedActuals(actuals)
    setResult(calculateMIS(actuals, config))
  }

  const handleExport = () => {
    if (!result || !usedActuals) return
    const lines = [
      'PSS Merchant Impact Score Report',
      `Month: ${config.month}`,
      needsDays ? `Accountable Days: ${fields.days}` : '',
      '',
      'Metric,Actual (per day),Score',
      `CPD,${usedActuals.cpd.toFixed(2)},${result.cpd}`,
      `GCR,$${usedActuals.gcr.toFixed(2)},${result.gcr}`,
      `QA,${fields.qa}%,${result.qa}`,
      '',
      `Total MIS,${result.total}`,
      `Status,${result.passing ? 'On Track' : 'Off Track'}`,
    ].filter(Boolean)
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MIS_${config.month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const days = parseFloat(fields.days)
  const computedCPD = cpdMode === 'total' && fields.cpd && days > 0
    ? (parseFloat(fields.cpd) / days).toFixed(2) : null
  const computedGCR = gcrMode === 'total' && fields.gcr && days > 0
    ? (parseFloat(fields.gcr) / days).toFixed(2) : null

  return (
    <div className="view-container">
      <h2>My MIS Calculator</h2>
      <p className="subtext">Month: <strong>{config.month}</strong></p>

      <form onSubmit={handleCalculate} className="input-form">
        <div className="form-grid">
          {needsDays && (
            <label className="field-narrow">
              <div className="field-header"><span>Days</span></div>
              <input
                type="number"
                name="days"
                value={fields.days}
                onChange={handleChange}
                placeholder="e.g. 21"
                min="1"
                step="1"
                required
              />
            </label>
          )}

          <label>
            <div className="field-header spaced">
              <span>{cpdMode === 'total' ? 'Total Contacts' : 'CPD (Contacts Per Day)'}</span>
              <div className="inline-toggle">
                <button type="button" className={`toggle-btn ${cpdMode === 'perday' ? 'active' : ''}`} onClick={() => switchMode('cpd', 'perday')}>Per Day</button>
                <button type="button" className={`toggle-btn ${cpdMode === 'total' ? 'active' : ''}`} onClick={() => switchMode('cpd', 'total')}>Monthly</button>
              </div>
            </div>
            <input
              type="number"
              name="cpd"
              value={fields.cpd}
              onChange={handleChange}
              placeholder={cpdMode === 'total' ? 'Total contacts for month' : 'Contacts per day'}
              step="0.01"
              required
            />
            <span className="target-hint">
              Target: {cpdMode === 'total' && days > 0
                ? `${(config.cpd.target * days).toFixed(0)} contacts`
                : `${config.cpd.target}/day`}
            </span>
            {computedCPD && <span className="computed-hint">= {computedCPD} contacts/day</span>}
          </label>

          <label>
            <div className="field-header spaced">
              <span>{gcrMode === 'total' ? 'Total GCR ($)' : 'GCR (Gross Cash Revenue Per Day)'}</span>
              <div className="inline-toggle">
                <button type="button" className={`toggle-btn ${gcrMode === 'perday' ? 'active' : ''}`} onClick={() => switchMode('gcr', 'perday')}>Per Day</button>
                <button type="button" className={`toggle-btn ${gcrMode === 'total' ? 'active' : ''}`} onClick={() => switchMode('gcr', 'total')}>Monthly</button>
              </div>
            </div>
            <input
              type="number"
              name="gcr"
              value={fields.gcr}
              onChange={handleChange}
              placeholder={gcrMode === 'total' ? 'Total GCR for month ($)' : 'GCR per day ($)'}
              step="0.01"
              required
            />
            <span className="target-hint">
              Target: {gcrMode === 'total' && days > 0
                ? `$${(config.gcr.target * days).toFixed(0)}`
                : `$${config.gcr.target}/day`}
            </span>
            {computedGCR && <span className="computed-hint">= ${computedGCR}/day</span>}
          </label>

          <label>
            <div className="field-header"><span>QA (Quality Assurance)</span></div>
            <input
              type="number"
              name="qa"
              value={fields.qa}
              onChange={handleChange}
              placeholder="QA score"
              step="0.01"
              min="0"
              max="100"
              required
            />
            <span className="target-hint">Target: {config.qa.target}%</span>
          </label>
        </div>

        <button type="submit" className="btn-primary">Calculate My Score</button>
      </form>

      {result && (
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
      )}
    </div>
  )
}
