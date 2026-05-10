export default function ScoreGauge({ score, min = -75, max = 75 }) {
  const pct = ((score - min) / (max - min)) * 100
  const color = score > 0 ? '#22c55e' : score === 0 ? '#f59e0b' : '#ef4444'

  return (
    <div className="gauge-wrap">
      <div className="gauge-bar-bg">
        <div
          className="gauge-bar-zero"
          style={{ left: `${((0 - min) / (max - min)) * 100}%` }}
        />
        <div
          className="gauge-bar-fill"
          style={{
            width: `${Math.abs(pct - ((0 - min) / (max - min)) * 100)}%`,
            left: score >= 0
              ? `${((0 - min) / (max - min)) * 100}%`
              : `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className="gauge-labels">
        <span>{min}</span>
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
