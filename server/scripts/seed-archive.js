import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SCORE_RAILS = {
  cpd: { min: -35, max: 35 },
  gcr: { min: -20, max: 20 },
  qa:  { min: -20, max: 20 },
}

function scoreMetric(actual, config, rail) {
  const { target, min, max } = config
  const { min: railMin, max: railMax } = rail
  if (actual >= target) {
    const ratio = (actual - target) / (max - target || 1)
    return Math.min(railMax, ratio * railMax)
  } else {
    const ratio = (target - actual) / (target - min || 1)
    return Math.max(railMin, -ratio * Math.abs(railMin))
  }
}

function computeAverages(results) {
  const valid = results.filter(Boolean)
  if (!valid.length) return null
  const avg = (arr) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100
  return {
    cpd:      avg(valid.map(r => r.actuals.cpd)),
    gcr:      avg(valid.map(r => r.actuals.gcr)),
    qa:       avg(valid.map(r => r.actuals.qa)),
    cpdPts:   avg(valid.map(r => r.cpd)),
    gcrPts:   avg(valid.map(r => r.gcr)),
    qaPts:    avg(valid.map(r => r.qa)),
    total:    avg(valid.map(r => r.total)),
    passRate: Math.round(valid.filter(r => r.passing).length / valid.length * 100) / 100,
    count:    valid.length,
  }
}

function calculateMIS(actuals, config) {
  const cpd = scoreMetric(actuals.cpd, config.cpd, SCORE_RAILS.cpd)
  const gcr = scoreMetric(actuals.gcr, config.gcr, SCORE_RAILS.gcr)
  const qa  = scoreMetric(actuals.qa,  config.qa,  SCORE_RAILS.qa)
  const total = cpd + gcr + qa
  return {
    cpd:   Math.round(cpd   * 100) / 100,
    gcr:   Math.round(gcr   * 100) / 100,
    qa:    Math.round(qa    * 100) / 100,
    total: Math.round(total * 100) / 100,
    passing: total > 0,
  }
}

// Configs for each month (targets ramp up slightly over the year)
const configs = {
  '2026-01': { month: '2026-01', cpd: { min: 13, target: 15, max: 18 }, gcr: { min: 35, target: 60, max: 90 }, qa: { min: 68, target: 83, max: 100 } },
  '2026-02': { month: '2026-02', cpd: { min: 13, target: 16, max: 19 }, gcr: { min: 38, target: 65, max: 95 }, qa: { min: 70, target: 84, max: 100 } },
  '2026-03': { month: '2026-03', cpd: { min: 14, target: 16, max: 19 }, gcr: { min: 40, target: 67, max: 100 }, qa: { min: 70, target: 84, max: 100 } },
  '2026-04': { month: '2026-04', cpd: { min: 14, target: 17, max: 20 }, gcr: { min: 40, target: 70, max: 100 }, qa: { min: 70, target: 85, max: 100 } },
}

// 12 guides with varying performance trajectories
// Each entry: [cpd, gcr, qa] per month Jan-Apr
const guideActuals = {
  'Alex Chen':       [[18.2,88,94], [19.1,90,95], [18.8,92,93], [19.5,95,96]],
  'Jordan Smith':    [[16.8,75,88], [17.2,78,89], [17.5,80,90], [18.0,82,91]],
  'Maya Rodriguez':  [[15.5,65,85], [16.0,68,86], [16.8,72,87], [17.2,75,88]],
  'Tyler Johnson':   [[14.2,58,82], [13.8,55,80], [15.0,62,83], [15.5,65,84]],
  'Sam Williams':    [[17.9,85,92], [17.5,83,91], [18.2,87,93], [17.8,86,92]],
  'Casey Brown':     [[12.5,45,75], [13.0,48,76], [12.8,50,78], [13.5,52,77]],
  'Morgan Davis':    [[16.2,70,86], [15.8,68,85], [16.5,72,87], [16.0,71,86]],
  'Riley Wilson':    [[11.0,38,70], [11.5,42,72], [12.2,44,73], [12.8,46,74]],
  'Drew Martinez':   [[15.0,63,84], [15.5,66,85], [16.0,69,86], [16.5,72,87]],
  'Avery Thompson':  [[18.8,92,95], [19.2,94,96], [19.5,96,97], [20.0,99,98]],
  'Quinn Anderson':  [[13.8,52,79], [14.2,55,80], [14.0,53,79], [14.5,58,81]],
  'Blake Nelson':    [[16.5,73,88], [16.2,71,87], [17.0,76,89], [17.5,79,90]],
}

const months = ['2026-01', '2026-02', '2026-03', '2026-04']
const archive = {}

months.forEach((month, mi) => {
  const config = configs[month]
  const guides = Object.keys(guideActuals).map(name => ({
    name,
    cpdMode: 'perday', cpd: String(guideActuals[name][mi][0]),
    gcrMode: 'perday', gcr: String(guideActuals[name][mi][1]),
    qa: String(guideActuals[name][mi][2]),
    days: '21',
  }))

  const results = Object.keys(guideActuals).map(name => {
    const [cpd, gcr, qa] = guideActuals[name][mi]
    const actuals = { cpd, gcr, qa }
    return { name, actuals, ...calculateMIS(actuals, config) }
  })

  archive[month] = {
    month,
    closedAt: new Date(`${month}-28T17:00:00.000Z`).toISOString(),
    config,
    guides,
    results,
    averages: computeAverages(results),
  }
})

writeFileSync(join(__dirname, '../data/archive.json'), JSON.stringify(archive, null, 2))
console.log('Seeded archive with', months.length, 'months,', Object.keys(guideActuals).length, 'guides each.')
months.forEach(m => {
  const passing = archive[m].results.filter(r => r.passing).length
  console.log(` ${m}: ${passing}/${Object.keys(guideActuals).length} passing`)
})
