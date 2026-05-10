import { Router } from 'express'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { requireAuth } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, '../data/config.json')

const router = Router()

router.get('/', (_req, res) => {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  res.json(config)
})

router.put('/', requireAuth, (req, res) => {
  const { month, cpd, gcr, qa } = req.body

  if (!month || !cpd || !gcr || !qa) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  for (const [key, vals] of Object.entries({ cpd, gcr, qa })) {
    const { target, min, max } = vals
    if (target == null || min == null || max == null) {
      return res.status(400).json({ error: `Missing target/min/max for ${key}` })
    }
    if (min >= target || target >= max) {
      return res.status(400).json({ error: `${key}: min < target < max required` })
    }
  }

  const config = { month, cpd, gcr, qa }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  res.json(config)
})

export default router
