const SCORE_RAILS = {
  cpd: { min: -35, max: 35 },
  gcr: { min: -20, max: 20 },
  qa:  { min: -20, max: 20 },
}

function scoreMetric(actual, config, rail) {
  const { target, min, max } = config
  const { min: railMin, max: railMax } = rail

  if (actual >= target) {
    const range = max - target
    if (range === 0) return actual > target ? railMax : 0
    const ratio = (actual - target) / range
    return Math.min(railMax, ratio * railMax)
  } else {
    const range = target - min
    if (range === 0) return railMin
    const ratio = (target - actual) / range
    return Math.max(railMin, -ratio * Math.abs(railMin))
  }
}

export function calculateMIS(actuals, config) {
  const cpd = scoreMetric(actuals.cpd, config.cpd, SCORE_RAILS.cpd)
  const gcr = scoreMetric(actuals.gcr, config.gcr, SCORE_RAILS.gcr)
  const qa  = scoreMetric(actuals.qa,  config.qa,  SCORE_RAILS.qa)
  const total = cpd + gcr + qa

  return {
    cpd: Math.round(cpd * 100) / 100,
    gcr: Math.round(gcr * 100) / 100,
    qa:  Math.round(qa  * 100) / 100,
    total: Math.round(total * 100) / 100,
    passing: total > 0,
  }
}

export { SCORE_RAILS }
