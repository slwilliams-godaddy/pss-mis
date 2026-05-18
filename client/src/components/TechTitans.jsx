import { useState, useEffect } from 'react'
import { getTechTitansData, getArchivedMonths } from '../utils/storage'

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function quarterMonths(year, q) {
  const start = (q - 1) * 3 + 1
  return [0, 1, 2].map(i => `${year}-${String(start + i).padStart(2, '0')}`)
}

function yqLabel(yq) {
  const [y, q] = yq.split('-').map(Number)
  return `Q${q} ${y}`
}

function rankLabel(i) {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return `#${i + 1}`
}

const fmtScore = (v) => (v > 0 ? '+' : '') + v
const scoreColor = (v) => v > 0 ? '#22c55e' : v < 0 ? '#ef4444' : '#f59e0b'

export default function TechTitans({ guideUser }) {
  const now = new Date()
  const curYear = now.getFullYear()
  const curQ = Math.ceil((now.getMonth() + 1) / 3)
  const curYQ = `${curYear}-${curQ}`

  const [selectedYQ, setSelectedYQ] = useState(curYQ)
  const [availableYQs, setAvailableYQs] = useState([curYQ])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getArchivedMonths()
      .then(months => {
        const yqSet = new Set(months.map(m => {
          const [y, mo] = m.split('-').map(Number)
          return `${y}-${Math.ceil(mo / 3)}`
        }))
        yqSet.add(curYQ)
        setAvailableYQs([...yqSet].sort().reverse())
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const [y, q] = selectedYQ.split('-').map(Number)
    const months = quarterMonths(y, q)
    let cancelled = false
    setLoading(true)
    setError('')
    setData(null)
    getTechTitansData(months)
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [selectedYQ])

  const [y, q] = selectedYQ.split('-').map(Number)
  const months = quarterMonths(y, q)

  return (
    <div className="tech-titans-tab">
      <div className="tech-titans-header">
        <div>
          <h2 className="tech-titans-title">Tech Titans</h2>
          <p className="tech-titans-subtitle">Uncapped MIS — Quarterly Rankings</p>
        </div>
        <select
          className="tt-quarter-select"
          value={selectedYQ}
          onChange={e => setSelectedYQ(e.target.value)}
        >
          {availableYQs.map(yq => (
            <option key={yq} value={yq}>{yqLabel(yq)}</option>
          ))}
        </select>
      </div>

      {loading && <p className="subtext">Loading…</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && data !== null && (
        data.length === 0
          ? <p className="subtext">No data available for {yqLabel(selectedYQ)} yet.</p>
          : (
            <div className="tt-table-wrap">
              <table className="tt-table">
                <thead>
                  <tr>
                    <th className="tt-th-rank">Rank</th>
                    <th>Guide</th>
                    {months.map(m => (
                      <th key={m} className="tt-th-month">{SHORT_MONTHS[+m.split('-')[1] - 1]}</th>
                    ))}
                    <th className="tt-th-total">Q Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((guide, idx) => {
                    const isMe = guideUser && guide.name === guideUser
                    return (
                      <tr key={guide.name} className={`tt-row${isMe ? ' tt-row-me' : ''}`}>
                        <td className="tt-rank">{rankLabel(idx)}</td>
                        <td className="tt-name">{guide.name}</td>
                        {months.map(m => {
                          const ms = guide.months[m]
                          return (
                            <td key={m} className="tt-score">
                              {ms
                                ? <span style={{ color: scoreColor(ms.total) }}>{fmtScore(ms.total)}</span>
                                : <span className="tt-empty">—</span>
                              }
                            </td>
                          )
                        })}
                        <td className="tt-total">
                          <span style={{ color: scoreColor(guide.quarterTotal), fontWeight: 700 }}>
                            {fmtScore(guide.quarterTotal)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  )
}
