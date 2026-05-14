import { supabase } from './supabase'
import { calculateMIS } from './misCalculator'

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data.session
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function changePassword(currentPassword, newPassword) {
  const session = await getSession()
  if (!session) throw new Error('Not signed in.')
  // Re-authenticate to verify current password
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password: currentPassword,
  })
  if (verifyError) throw new Error('Current password is incorrect.')
  if (newPassword.trim().length < 4) throw new Error('Password must be at least 4 characters.')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

export async function sendOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw new Error(error.message)
}

export async function verifyOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw new Error(error.message)
  return data.session
}

// ── Supervisors ───────────────────────────────────────────────────────────────

export async function getSupervisors() {
  const { data, error } = await supabase.from('supervisors').select('email').order('email')
  if (error) throw new Error(error.message)
  return data.map(r => r.email)
}

export async function addSupervisor(email) {
  const { error } = await supabase.from('supervisors').insert({ email: email.trim().toLowerCase() })
  if (error) throw new Error(error.message)
}

export async function removeSupervisor(email) {
  const supervisors = await getSupervisors()
  if (supervisors.length <= 1) throw new Error('Cannot remove the last supervisor.')
  const { error } = await supabase.from('supervisors').delete().eq('email', email)
  if (error) throw new Error(error.message)
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

export async function getConfig() {
  // Fetch the most recent config row (highest month value)
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

// Converts a DB row back to the guide input format used by SupervisorView
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

function guideToRow(guide, month, { monthClosed = false, published = false } = {}) {
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
    published,
    month_closed: monthClosed,
  }
  if (guide.id) row.id = guide.id
  return row
}

export async function getTeam(month) {
  const { data, error } = await supabase
    .from('mis_scores')
    .select('*')
    .eq('month', month)
    .eq('month_closed', false)
    .order('guide_name')
  if (error) throw new Error(error.message)
  return { month, guides: data.map(rowToGuide) }
}

export async function saveTeam(month, guides) {
  if (!guides.length) return
  const rows = guides.map(g => guideToRow(g, month))

  // Upsert rows that have an id, insert new ones
  const toUpsert = rows.filter(r => r.id)
  const toInsert = rows.filter(r => !r.id)

  if (toUpsert.length) {
    const { error } = await supabase.from('mis_scores').upsert(toUpsert, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }
  if (toInsert.length) {
    const { data, error } = await supabase.from('mis_scores').insert(toInsert).select('id, guide_email')
    if (error) throw new Error(error.message)
    // Assign new ids back to guides
    data.forEach((row, i) => { guides[i].id = row.id })
  }
}

export async function deleteGuideRow(id) {
  const { error } = await supabase.from('mis_scores').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function closeMonth(month) {
  const { error } = await supabase
    .from('mis_scores')
    .update({ month_closed: true, published: true })
    .eq('month', month)
    .eq('month_closed', false)
  if (error) throw new Error(error.message)
}

// ── Archive ───────────────────────────────────────────────────────────────────

export async function getArchivedMonths() {
  const { data, error } = await supabase
    .from('mis_scores')
    .select('month')
    .eq('month_closed', true)
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
  return {
    month,
    guides,
    results,
    averages: computeAverages(results),
    config,
  }
}

export async function getArchivedMonth(month) {
  const [scoresResult, configResult] = await Promise.all([
    supabase.from('mis_scores').select('*').eq('month', month).eq('month_closed', true).order('guide_name'),
    supabase.from('mis_config').select('*').eq('month', month).limit(1),
  ])
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  if (configResult.error) throw new Error(configResult.error.message)
  const config = configResult.data.length ? rowToConfig(configResult.data[0]) : null
  return scoresToArchiveData(month, scoresResult.data, config)
}

export async function upsertArchivedMonth(month, { guides, config }) {
  if (!guides || !guides.length) return null

  // Delete existing closed rows for this month and re-insert
  const { error: delError } = await supabase
    .from('mis_scores')
    .delete()
    .eq('month', month)
    .eq('month_closed', true)
  if (delError) throw new Error(delError.message)

  const rows = guides.map(g => guideToRow(g, month, { monthClosed: true, published: true }))
  const { data, error } = await supabase.from('mis_scores').insert(rows).select('*')
  if (error) throw new Error(error.message)

  if (config) await saveConfig(config)

  const savedConfig = config || await getConfig()
  return scoresToArchiveData(month, data, savedConfig)
}

// ── Guide score lookup ────────────────────────────────────────────────────────

export async function getMyPublishedScores() {
  const { data, error } = await supabase
    .from('mis_scores')
    .select('*')
    .eq('published', true)
    .order('month', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
