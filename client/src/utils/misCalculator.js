const MULTIPLIERS = { cpd: 1.5, gcr: 1.0, qa: 1.0 }

const SCORE_RAILS = {
  cpd: { min: -35, max: 35 },
  gcr: { min: -20, max: 20 },
  qa:  { min: -20, max: 20 },
}

function scoreMetric(actual, target, rail, multiplier) {
  if (!target) return 0
  const raw = ((actual / target) - 1) * 100 * multiplier
  return Math.min(rail.max, Math.max(rail.min, raw))
}

export function calculateMIS(actuals, config) {
  const cpd = scoreMetric(actuals.cpd, config.cpd.target, SCORE_RAILS.cpd, MULTIPLIERS.cpd)
  const gcr = scoreMetric(actuals.gcr, config.gcr.target, SCORE_RAILS.gcr, MULTIPLIERS.gcr)
  const qa  = scoreMetric(actuals.qa,  config.qa.target,  SCORE_RAILS.qa,  MULTIPLIERS.qa)
  const total = cpd + gcr + qa

  return {
    cpd: Math.round(cpd * 100) / 100,
    gcr: Math.round(gcr * 100) / 100,
    qa:  Math.round(qa  * 100) / 100,
    total: Math.round(total * 100) / 100,
    passing: total > 0,
  }
}

export { MULTIPLIERS, SCORE_RAILS }
