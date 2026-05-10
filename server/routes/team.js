import { Router } from 'express'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { requireAuth } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEAM_PATH    = join(__dirname, '../data/team.json')
const ARCHIVE_PATH = join(__dirname, '../data/archive.json')

const readJSON  = (p) => JSON.parse(readFileSync(p, 'utf8'))
const writeJSON = (p, d) => writeFileSync(p, JSON.stringify(d, null, 2))

function computeAverages(results) {
  const valid = (results || []).filter(Boolean)
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

const router = Router()

router.get('/', requireAuth, (_req, res) => {
  res.json(readJSON(TEAM_PATH))
})

router.put('/', requireAuth, (req, res) => {
  const { month, guides } = req.body
  if (!month || !Array.isArray(guides)) {
    return res.status(400).json({ error: 'Invalid team data' })
  }
  const data = { month, guides }
  writeJSON(TEAM_PATH, data)
  res.json(data)
})

// Archive current month and reset
router.post('/close', requireAuth, (req, res) => {
  const { results, config } = req.body
  const team = readJSON(TEAM_PATH)

  if (!team.month) {
    return res.status(400).json({ error: 'No active month to close' })
  }

  const archive = readJSON(ARCHIVE_PATH)
  archive[team.month] = {
    month: team.month,
    closedAt: new Date().toISOString(),
    config,
    guides: team.guides,
    results: results || [],
    averages: computeAverages(results),
  }
  writeJSON(ARCHIVE_PATH, archive)

  // Reset — keep names, clear actuals
  const reset = {
    month: team.month,
    guides: team.guides.map(g => ({
      name: g.name,
      cpdMode: 'perday', cpd: '',
      gcrMode: 'perday', gcr: '',
      qa: '', days: '',
    })),
  }
  writeJSON(TEAM_PATH, reset)

  res.json({ archived: team.month, current: reset })
})

// List archived months (newest first)
router.get('/archive', requireAuth, (_req, res) => {
  const archive = readJSON(ARCHIVE_PATH)
  const months = Object.keys(archive).sort().reverse()
  res.json(months)
})

// Get one archived month
router.get('/archive/:month', requireAuth, (req, res) => {
  const archive = readJSON(ARCHIVE_PATH)
  const entry = archive[req.params.month]
  if (!entry) return res.status(404).json({ error: 'Month not found' })
  res.json(entry)
})

// Upsert an archived month
router.put('/archive/:month', requireAuth, (req, res) => {
  const archive = readJSON(ARCHIVE_PATH)
  const { guides, results, config } = req.body
  const existing = archive[req.params.month] || {}
  archive[req.params.month] = {
    ...existing,
    month: req.params.month,
    guides: guides || existing.guides || [],
    results: results || [],
    averages: computeAverages(results),
    config: config || existing.config,
    updatedAt: new Date().toISOString(),
    closedAt: existing.closedAt || new Date().toISOString(),
  }
  writeJSON(ARCHIVE_PATH, archive)
  res.json(archive[req.params.month])
})

export default router
