import { calculateMIS } from './misCalculator'

const SAMPLE_NAMES = [
  'Alex Chen', 'Jordan Smith', 'Maya Rodriguez', 'Tyler Johnson',
  'Sam Williams', 'Casey Brown', 'Morgan Davis', 'Riley Wilson',
  'Drew Martinez', 'Avery Thompson', 'Quinn Anderson', 'Blake Nelson',
]

const KEYS = {
  config:  'pss-mis:config',
  team:    'pss-mis:team',
  archive: 'pss-mis:archive',
  users:   'pss-mis:users',
}

const DEFAULT_USERS = [
  { username: 'Lisa', password: 'changeme' },
  { username: 'Stu',  password: 'xidsax-pubbar-tEtzi5' },
]

const DEFAULT_CONFIG = {
  month: '2026-05',
  cpd:          { min: 14, target: 17, max: 20  },
  gcrVoice:     { min: 40, target: 70, max: 100 },
  gcrMessaging: { min: 15, target: 30, max: 60  },
  qa:           { min: 70, target: 85, max: 100 },
}

const DEFAULT_TEAM = {
  month: '2026-05',
  guides: [{ name: '', channel: 'voice', cpdMode: 'perday', cpd: '', gcrMode: 'perday', gcr: '', qa: '', days: '' }],
}

const DEFAULT_ARCHIVE = {}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function computeAverages(results) {
  const valid = (results || []).filter(Boolean)
  if (!valid.length) return null
  const avg = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100
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

export function getConfig() {
  const cfg = read(KEYS.config, DEFAULT_CONFIG)
  if (cfg.gcr && !cfg.gcrVoice) {
    cfg.gcrVoice = { ...cfg.gcr }
    cfg.gcrMessaging = { ...cfg.gcr }
    delete cfg.gcr
    write(KEYS.config, cfg)
  }
  return cfg
}

export function saveConfig(config) {
  write(KEYS.config, config)
  return config
}

export function getTeam() {
  return read(KEYS.team, DEFAULT_TEAM)
}

export function saveTeam(month, guides) {
  const data = { month, guides }
  write(KEYS.team, data)
  return data
}

export function closeMonth(results, config) {
  const team = getTeam()
  if (!team.month) throw new Error('No active month to close')

  const archive = read(KEYS.archive, DEFAULT_ARCHIVE)
  archive[team.month] = {
    month: team.month,
    closedAt: new Date().toISOString(),
    config,
    guides: team.guides,
    results: results || [],
    averages: computeAverages(results),
  }
  write(KEYS.archive, archive)

  const reset = {
    month: team.month,
    guides: team.guides.map(g => ({
      name: g.name,
      channel: g.channel || 'voice',
      cpdMode: 'perday', cpd: '',
      gcrMode: 'perday', gcr: '',
      qa: '', days: '',
    })),
  }
  write(KEYS.team, reset)
  return { archived: team.month, current: reset }
}

export function getArchivedMonths() {
  const archive = read(KEYS.archive, DEFAULT_ARCHIVE)
  return Object.keys(archive).sort().reverse()
}

export function getArchivedMonth(month) {
  const archive = read(KEYS.archive, DEFAULT_ARCHIVE)
  return archive[month] || null
}

export function upsertArchivedMonth(month, { guides, results, config }) {
  const archive = read(KEYS.archive, DEFAULT_ARCHIVE)
  const existing = archive[month] || {}
  archive[month] = {
    ...existing,
    month,
    guides: guides || existing.guides || [],
    results: results || [],
    averages: computeAverages(results),
    config: config || existing.config,
    updatedAt: new Date().toISOString(),
    closedAt: existing.closedAt || new Date().toISOString(),
  }
  write(KEYS.archive, archive)
  return archive[month]
}

export function generateSampleData(currentConfig) {
  const [year, month] = currentConfig.month.split('-').map(Number)
  const rand = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100

  const archive = {}
  for (let m = 1; m < month; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`
    const cfg = {
      month: monthKey,
      cpd:          { min: Math.round(rand(12, 15)), target: Math.round(rand(15, 18)), max: Math.round(rand(18, 22)) },
      gcrVoice:     { min: Math.round(rand(35, 45)), target: Math.round(rand(60, 75)), max: Math.round(rand(90, 110)) },
      gcrMessaging: { min: Math.round(rand(12, 18)), target: Math.round(rand(25, 35)), max: Math.round(rand(50, 70))  },
      qa:           { min: Math.round(rand(67, 72)), target: Math.round(rand(82, 87)), max: 100 },
    }
    const guides = SAMPLE_NAMES.map((name, i) => {
      const channel = i < SAMPLE_NAMES.length / 2 ? 'voice' : 'messaging'
      const gcrCfg = channel === 'messaging' ? cfg.gcrMessaging : cfg.gcrVoice
      return {
        name, channel,
        cpdMode: 'perday', cpd: String(rand(cfg.cpd.min - 2, cfg.cpd.max + 2)),
        gcrMode: 'perday', gcr: String(rand(gcrCfg.min - 5, gcrCfg.max + 5)),
        qa: String(rand(cfg.qa.min - 5, 100)),
        days: '21',
      }
    })
    const results = guides.map(g => {
      const gcrCfg = g.channel === 'messaging' ? cfg.gcrMessaging : cfg.gcrVoice
      const effectiveCfg = { ...cfg, gcr: gcrCfg }
      const actuals = { cpd: parseFloat(g.cpd), gcr: parseFloat(g.gcr), qa: parseFloat(g.qa) }
      return { name: g.name, channel: g.channel, actuals, ...calculateMIS(actuals, effectiveCfg) }
    })
    archive[monthKey] = {
      month: monthKey,
      closedAt: new Date(year, m - 1, 28, 17, 0, 0).toISOString(),
      config: cfg,
      guides,
      results,
      averages: computeAverages(results),
    }
  }
  write(KEYS.archive, archive)
  return archive
}

function getUsers() {
  // migrate old single-password storage
  const oldPw = localStorage.getItem('pss-mis:password')
  if (oldPw) {
    const users = [{ username: 'Lisa', password: JSON.parse(oldPw) }]
    write(KEYS.users, users)
    localStorage.removeItem('pss-mis:password')
    return users
  }
  return read(KEYS.users, DEFAULT_USERS)
}

export function checkUser(username, password) {
  return getUsers().some(u => u.username === username && u.password === password)
}

export function getSupervisorUsernames() {
  return getUsers().map(u => u.username)
}

export function addSupervisorUser(username, password) {
  const users = getUsers()
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase()))
    throw new Error('A user with that name already exists.')
  write(KEYS.users, [...users, { username, password }])
}

export function removeSupervisorUser(username) {
  const users = getUsers()
  if (users.length <= 1) throw new Error('Cannot remove the last supervisor.')
  write(KEYS.users, users.filter(u => u.username !== username))
}

export function changeSupervisorPassword(username, currentPassword, newPassword) {
  const users = getUsers()
  const idx = users.findIndex(u => u.username === username)
  if (idx === -1) throw new Error('User not found.')
  if (users[idx].password !== currentPassword) throw new Error('Current password is incorrect.')
  if (newPassword.trim().length < 4) throw new Error('Password must be at least 4 characters.')
  const updated = [...users]
  updated[idx] = { ...updated[idx], password: newPassword }
  write(KEYS.users, updated)
}

export function exportBackup() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      config:  read(KEYS.config,  DEFAULT_CONFIG),
      team:    read(KEYS.team,    DEFAULT_TEAM),
      archive: read(KEYS.archive, DEFAULT_ARCHIVE),
      users:   getUsers(),
    },
  }
  return JSON.stringify(payload, null, 2)
}

export function clearAllData() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k))
  localStorage.removeItem('pss-mis:password')
  write(KEYS.archive, {})
}

export function importBackup(jsonString) {
  const parsed = JSON.parse(jsonString)
  if (!parsed || !parsed.data) throw new Error('Invalid backup file format.')
  const { config, team, archive, users, password } = parsed.data
  if (config)  write(KEYS.config,  config)
  if (team)    write(KEYS.team,    team)
  if (archive) write(KEYS.archive, archive)
  if (users)   write(KEYS.users,   users)
  else if (password) write(KEYS.users, [{ username: 'Lisa', password }])
  return parsed.exportedAt
}
