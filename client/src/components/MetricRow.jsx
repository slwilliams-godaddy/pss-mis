export default function MetricRow({ label, score, railMin, railMax }) {
  const pct = ((score - railMin) / (railMax - railMin)) * 100
  const zeroPct = ((0 - railMin) / (railMax - railMin)) * 100
  const color = score > 0 ? '#22c55e' : score === 0 ? '#f59e0b' : '#ef4444'

  return (
    <div className="metric-row">
      <div className="metric-label">{label}</div>
      <div className="metric-bar-wrap">
        <div className="gauge-bar-bg small">
          <div className="gauge-bar-zero" style={{ left: `${zeroPct}%` }} />
          <div
            className="gauge-bar-fill"
            style={{
              width: `${Math.abs(pct - zeroPct)}%`,
              left: score >= 0 ? `${zeroPct}%` : `${pct}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <div className="metric-range-labels">
          <span>{railMin}</span>
          <span>{railMax}</span>
        </div>
      </div>
      <div className="metric-score" style={{ color }}>{score > 0 ? `+${score}` : score}</div>
    </div>
  )
}
