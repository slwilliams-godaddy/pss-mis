import { supabase } from './supabase'
import { calculateMIS } from './misCalculator'

// ── Password hashing (Web Crypto SHA-256) ─────────────────────────────────────

async function hashPassword(password) {
  const data = new TextEncoder().encode(password)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Supervisor auth ───────────────────────────────────────────────────────────

export async function checkUser(username, password) {
  const hash = await hashPassword(password)
  const { data, error } = await supabase
    .from('supervisor_credentials')
    .select('username')
    .eq('username', username)
    .eq('password_hash', hash)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data !== null
}

export async function getSupervisorUsernames() {
  const { data, error } = await supabase
    .from('supervisor_credentials')
    .select('username')
    .order('username')
  if (error) throw new Error(error.message)
  return data.map(r => r.username)
}

export async function addSupervisorUser(username, password) {
  const hash = await hashPassword(password)
  const { error } = await supabase
    .from('supervisor_credentials')
    .insert({ username: username.trim(), password_hash: hash })
  if (error) {
    if (error.code === '23505') throw new Error('A user with that name already exists.')
    throw new Error(error.message)
  }
}

export async function removeSupervisorUser(username) {
  const usernames = await getSupervisorUsernames()
  if (usernames.length <= 1) throw new Error('Cannot remove the last supervisor.')
  const { error } = await supabase
    .from('supervisor_credentials')
    .delete()
    .eq('username', username)
  if (error) throw new Error(error.message)
}

export async function changeSupervisorPassword(username, currentPassword, newPassword) {
  if (newPassword.trim().length < 4) throw new Error('Password must be at least 4 characters.')
  const currentHash = await hashPassword(currentPassword)
  const { data, error } = await supabase
    .from('supervisor_credentials')
    .select('username')
    .eq('username', username)
    .eq('password_hash', currentHash)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Current password is incorrect.')
  const newHash = await hashPassword(newPassword)
  const { error: updateError } = await supabase
    .from('supervisor_credentials')
    .update({ password_hash: newHash })
    .eq('username', username)
  if (updateError) throw new Error(updateError.message)
}

// ── Guide auth ────────────────────────────────────────────────────────────────

export async function checkGuide(guideName, password) {
  const hash = await hashPassword(password)
  const { data, error } = await supabase
    .from('guide_credentials')
    .select('guide_name')
    .eq('guide_name', guideName)
    .eq('password_hash', hash)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data !== null
}

export async function getGuideNames() {
  const { data, error } = await supabase
    .from('guide_credentials')
    .select('guide_name')
    .order('guide_name')
  if (error) throw new Error(error.message)
  return data.map(r => r.guide_name)
}

export async function ensureGuideCredentials(guideNames) {
  const names = guideNames.filter(n => n && n.trim())
  if (!names.length) return
  const hash = await hashPassword('changeme')
  const rows = names.map(n => ({ guide_name: n.trim(), password_hash: hash }))
  const { error } = await supabase
    .from('guide_credentials')
    .upsert(rows, { onConflict: 'guide_name', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

export async function changeGuidePassword(guideName, currentPassword, newPassword) {
  if (newPassword.trim().length < 4) throw new Error('Password must be at least 4 characters.')
  const currentHash = await hashPassword(currentPassword)
  const { data, error } = await supabase
    .from('guide_credentials')
    .select('guide_name')
    .eq('guide_name', guideName)
    .eq('password_hash', currentHash)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Current password is incorrect.')
  const newHash = await hashPassword(newPassword)
  const { error: updateError } = await supabase
    .from('guide_credentials')
    .update({ password_hash: newHash })
    .eq('guide_name', guideName)
  if (updateError) throw new Error(updateError.message)
}

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  month: '2026-05',
  cpd:          { min: 14, target: 17, max: 20  },
  gcrVoice:     { min: 40, target: 70, max: 100 },
  gcrMessaging: { min: 15, target: 30, max: 60  },
  qa:           { min: 70, target: 85, max: 100 },
}

function rowToConfig(row) {
  return {
    month: row.month,
    cpd:          { min: Number(row.cpd_min),          target: Number(row.cpd_target),          max: Number(row.cpd_max)          },
    gcrVoice:     { min: Number(row.gcr_voice_min),     target: Number(row.gcr_voice_target),     max: Number(row.gcr_voice_max)     },
    gcrMessaging: { min: Number(row.gcr_messaging_min), target: Number(row.gcr_messaging_target), max: Number(row.gcr_messaging_max) },
    qa:           { min: Number(row.qa_min),            target: Number(row.qa_target),            max: Number(row.qa_max)            },
  }
}

function configToRow(cfg) {
  return {
    month:                cfg.month,
    cpd_min:              cfg.cpd.min,
    cpd_target:           cfg.cpd.target,
    cpd_max:              cfg.cpd.max,
    gcr_voice_min:        cfg.gcrVoice.min,
    gcr_voice_target:     cfg.gcrVoice.target,
    gcr_voice_max:        cfg.gcrVoice.max,
    gcr_messaging_min:    cfg.gcrMessaging.min,
    gcr_messaging_target: cfg.gcrMessaging.target,
    gcr_messaging_max:    cfg.gcrMessaging.max,
    qa_min:               cfg.qa.min,
    qa_target:            cfg.qa.target,
    qa_max:               cfg.qa.max,
  }
}

export async function getConfigMonths() {
  const { data, error } = await supabase
    .from('mis_config')
    .select('month')
    .order('month', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(r => r.month)
}

export async function getConfigForMonth(month) {
  const { data, error } = await supabase
    .from('mis_config')
    .select('*')
    .eq('month', month)
    .limit(1)
  if (error) throw new Error(error.message)
  if (!data || !data.length) return null
  return rowToConfig(data[0])
}

export async function getConfig() {
  const { data, error } = await supabase
    .from('mis_config')
    .select('*')
    .order('month', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return DEFAULT_CONFIG
  return rowToConfig(data[0])
}

export async function saveConfig(config) {
  const { error } = await supabase
    .from('mis_config')
    .upsert(configToRow(config), { onConflict: 'month' })
  if (error) throw new Error(error.message)
  return config
}

// ── Team / Scores ─────────────────────────────────────────────────────────────

function rowToGuide(row) {
  return {
    id: row.id,
    name: row.guide_name,
    email: row.guide_email,
    channel: row.channel,
    cpdMode: 'perday',
    cpd: row.cpd != null ? String(row.cpd) : '',
    gcrMode: 'perday',
    gcr: row.gcr != null ? String(row.gcr) : '',
    qa: row.qa != null ? String(row.qa) : '',
    days: row.accountable_days != null ? String(row.accountable_days) : '',
  }
}

function guideToRow(guide, month) {
  const days = parseFloat(guide.days)
  const cpd = guide.cpdMode === 'total' && !isNaN(days) && days > 0
    ? parseFloat(guide.cpd) / days
    : parseFloat(guide.cpd)
  const gcr = guide.gcrMode === 'total' && !isNaN(days) && days > 0
    ? parseFloat(guide.gcr) / days
    : parseFloat(guide.gcr)
  const row = {
    month,
    guide_name: guide.name || '',
    guide_email: guide.email || '',
    channel: guide.channel || 'voice',
    cpd: isNaN(cpd) ? null : cpd,
    gcr: isNaN(gcr) ? null : gcr,
    qa: parseFloat(guide.qa) || null,
    accountable_days: isNaN(days) ? null : Math.round(days * 10) / 10,
  }
  if (guide.id) row.id = guide.id
  return row
}

export async function getTeam(month) {
  const { data, error } = await supabase
    .from('mis_scores')
    .select('*')
    .eq('month', month)
    .order('guide_name')
  if (error) throw new Error(error.message)
  return { month, guides: data.map(rowToGuide) }
}

// Returns an updated guides array with IDs assigned from newly inserted rows.
export async function saveTeam(month, guides) {
  if (!guides.length) return guides
  const rows = guides.map(g => guideToRow(g, month))
  const upsertRows = rows.filter(r => r.id)
  const insertRows = rows.filter(r => !r.id)
  const insertIndices = guides.reduce((acc, g, i) => { if (!g.id) acc.push(i); return acc }, [])
  if (upsertRows.length) {
    const { error } = await supabase.from('mis_scores').upsert(upsertRows, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }
  if (insertRows.length) {
    const { data, error } = await supabase.from('mis_scores').insert(insertRows).select('id')
    if (error) throw new Error(error.message)
    const updated = [...guides]
    data.forEach((row, i) => {
      updated[insertIndices[i]] = { ...updated[insertIndices[i]], id: row.id }
    })
    // Ensure guide credentials exist for any new named guides
    const newNames = insertIndices.map(idx => guides[idx].name).filter(Boolean)
    if (newNames.length) ensureGuideCredentials(newNames).catch(() => {})
    return updated
  }
  // Ensure credentials for any named guides (idempotent)
  const namedGuides = guides.filter(g => g.name && !g.id).map(g => g.name)
  if (namedGuides.length) ensureGuideCredentials(namedGuides).catch(() => {})
  return guides
}

// ── Guides roster ─────────────────────────────────────────────────────────────

export async function getGuides() {
  const { data, error } = await supabase
    .from('guides')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return data
}

export async function getGuidesWithHistory() {
  const [guidesResult, scoresResult] = await Promise.all([
    supabase.from('guides').select('*').order('name'),
    supabase.from('mis_scores').select('guide_name').neq('guide_name', ''),
  ])
  if (guidesResult.error) throw new Error(guidesResult.error.message)
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  const namesWithHistory = new Set(scoresResult.data.map(r => r.guide_name))
  return guidesResult.data.map(g => ({ ...g, hasHistory: namesWithHistory.has(g.name) }))
}

export async function addGuide({ name, channel }) {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Name is required.')
  const { error } = await supabase
    .from('guides')
    .insert({ name: trimmedName, channel: channel || 'voice' })
  if (error) {
    if (error.code === '23505') throw new Error('A guide with that name already exists.')
    throw new Error(error.message)
  }
  await ensureGuideCredentials([trimmedName])
}

export async function updateGuide(name, updates) {
  const { error } = await supabase
    .from('guides')
    .update(updates)
    .eq('name', name)
  if (error) throw new Error(error.message)
}

export async function resetGuidePassword(guideName) {
  const hash = await hashPassword('changeme')
  const { error } = await supabase
    .from('guide_credentials')
    .update({ password_hash: hash })
    .eq('guide_name', guideName)
  if (error) throw new Error(error.message)
}

export async function deleteGuide(name) {
  const { data, error } = await supabase
    .from('mis_scores')
    .select('id')
    .eq('guide_name', name)
    .limit(1)
  if (error) throw new Error(error.message)
  if (data.length > 0) throw new Error('Cannot remove a guide with historical data. Deactivate them instead.')
  await supabase.from('guide_credentials').delete().eq('guide_name', name)
  const { error: deleteError } = await supabase.from('guides').delete().eq('name', name)
  if (deleteError) throw new Error(deleteError.message)
}

export async function deleteGuideRow(id) {
  const { error } = await supabase.from('mis_scores').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function publishMonth(month) {
  const { error } = await supabase
    .from('mis_scores')
    .update({ published: true })
    .eq('month', month)
  if (error) throw new Error(error.message)
}

export async function clearMonthData(month) {
  const { error } = await supabase.from('mis_scores').delete().eq('month', month)
  if (error) throw new Error(error.message)
}

// ── Archive / Trend ───────────────────────────────────────────────────────────

export async function getArchivedMonths() {
  const { data, error } = await supabase
    .from('mis_scores')
    .select('month')
    .neq('guide_name', '')
  if (error) throw new Error(error.message)
  return [...new Set(data.map(r => r.month))].sort().reverse()
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

function scoresToArchiveData(month, rows, config) {
  const guides = rows.map(rowToGuide)
  const results = rows.map(row => {
    if (row.cpd == null || row.gcr == null || row.qa == null || row.accountable_days == null) return null
    const actuals = { cpd: Number(row.cpd), gcr: Number(row.gcr), qa: Number(row.qa) }
    const gcrCfg = row.channel === 'messaging'
      ? (config?.gcrMessaging ?? config?.gcrVoice)
      : (config?.gcrVoice ?? config?.gcr)
    return {
      name: row.guide_name,
      channel: row.channel,
      actuals,
      ...calculateMIS(actuals, { ...config, gcr: gcrCfg }),
    }
  })
  return { month, guides, results, averages: computeAverages(results), config }
}

export async function getArchivedMonth(month) {
  const [scoresResult, configResult] = await Promise.all([
    supabase.from('mis_scores').select('*').eq('month', month).order('guide_name'),
    supabase.from('mis_config').select('*').eq('month', month).limit(1),
  ])
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  if (configResult.error) throw new Error(configResult.error.message)
  const config = configResult.data.length ? rowToConfig(configResult.data[0]) : null
  return scoresToArchiveData(month, scoresResult.data, config)
}

// ── Guide history (requires guide login) ─────────────────────────────────────

export async function getGuideHistory(guideName) {
  const [scoresResult, configsResult] = await Promise.all([
    supabase.from('mis_scores').select('*').eq('guide_name', guideName).eq('published', true).order('month'),
    supabase.from('mis_config').select('*'),
  ])
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  if (configsResult.error) throw new Error(configsResult.error.message)

  const configByMonth = {}
  configsResult.data.forEach(row => { configByMonth[row.month] = rowToConfig(row) })

  return scoresResult.data.map(row => {
    const config = configByMonth[row.month]
    if (!config || row.cpd == null || row.gcr == null || row.qa == null) return null
    const actuals = { cpd: Number(row.cpd), gcr: Number(row.gcr), qa: Number(row.qa) }
    const gcrCfg = row.channel === 'messaging' ? config.gcrMessaging : config.gcrVoice
    return { month: row.month, channel: row.channel, actuals, ...calculateMIS(actuals, { ...config, gcr: gcrCfg }) }
  }).filter(Boolean)
}
