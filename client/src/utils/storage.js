import { supabase } from './supabase'
import { calculateMISGeneric, calculateUnboundedMISGeneric } from './misCalculator'
import { TEAM_DEFS, resolveConfigByKey } from './teamConfig'

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
  if (!data) return null
  return { username: data.username }
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

// ── Manager auth ──────────────────────────────────────────────────────────────

export async function checkManager(username, password) {
  const hash = await hashPassword(password)
  const { data, error } = await supabase
    .from('manager_credentials')
    .select('username')
    .eq('username', username)
    .eq('password_hash', hash)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { username: data.username }
}

export async function getManagerUsernames() {
  const { data, error } = await supabase
    .from('manager_credentials')
    .select('username')
    .order('username')
  if (error) throw new Error(error.message)
  return data.map(r => r.username)
}

export async function addManagerUser(username, password) {
  const hash = await hashPassword(password)
  const { error } = await supabase
    .from('manager_credentials')
    .insert({ username: username.trim(), password_hash: hash })
  if (error) {
    if (error.code === '23505') throw new Error('A user with that name already exists.')
    throw new Error(error.message)
  }
}

export async function removeManagerUser(username) {
  const usernames = await getManagerUsernames()
  if (usernames.length <= 1) throw new Error('Cannot remove the last manager.')
  const { error } = await supabase
    .from('manager_credentials')
    .delete()
    .eq('username', username)
  if (error) throw new Error(error.message)
}

export async function changeManagerPassword(username, currentPassword, newPassword) {
  if (newPassword.trim().length < 4) throw new Error('Password must be at least 4 characters.')
  const currentHash = await hashPassword(currentPassword)
  const { data, error } = await supabase
    .from('manager_credentials')
    .select('username')
    .eq('username', username)
    .eq('password_hash', currentHash)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Current password is incorrect.')
  const newHash = await hashPassword(newPassword)
  const { error: updateError } = await supabase
    .from('manager_credentials')
    .update({ password_hash: newHash })
    .eq('username', username)
  if (updateError) throw new Error(updateError.message)
}

// ── Guide auth ────────────────────────────────────────────────────────────────

export async function checkGuide(guideName, password) {
  const hash = await hashPassword(password)
  const { data: cred, error: credError } = await supabase
    .from('guide_credentials')
    .select('guide_name')
    .eq('guide_name', guideName)
    .eq('password_hash', hash)
    .maybeSingle()
  if (credError) throw new Error(credError.message)
  if (!cred) return null
  const { data: guide, error: guideError } = await supabase
    .from('guides')
    .select('active, team')
    .eq('name', guideName)
    .maybeSingle()
  if (guideError) throw new Error(guideError.message)
  if (!guide?.active) return null
  return { team: guide.team || 'pss' }
}

export async function getGuideNames(team) {
  let query = supabase.from('guides').select('name').eq('active', true).order('name')
  if (team) query = query.eq('team', team)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data.map(r => r.name)
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

function rowToConfig(row, team) {
  if (team !== 'pss') {
    return { month: row.month, ...(row.config_json || TEAM_DEFS[team].defaultConfig) }
  }
  return {
    month: row.month,
    cpd:          { min: Number(row.cpd_min),          target: Number(row.cpd_target),          max: Number(row.cpd_max)          },
    gcrVoice:     { min: Number(row.gcr_voice_min),     target: Number(row.gcr_voice_target),     max: Number(row.gcr_voice_max)     },
    gcrMessaging: { min: Number(row.gcr_messaging_min), target: Number(row.gcr_messaging_target), max: Number(row.gcr_messaging_max) },
    qa:           { min: Number(row.qa_min),            target: Number(row.qa_target),            max: Number(row.qa_max)            },
  }
}

function configToRow(config, team) {
  if (team !== 'pss') {
    const { month, ...configData } = config
    return { month, team, config_json: configData }
  }
  return {
    month:                config.month,
    team:                 'pss',
    cpd_min:              config.cpd.min,
    cpd_target:           config.cpd.target,
    cpd_max:              config.cpd.max,
    gcr_voice_min:        config.gcrVoice.min,
    gcr_voice_target:     config.gcrVoice.target,
    gcr_voice_max:        config.gcrVoice.max,
    gcr_messaging_min:    config.gcrMessaging.min,
    gcr_messaging_target: config.gcrMessaging.target,
    gcr_messaging_max:    config.gcrMessaging.max,
    qa_min:               config.qa.min,
    qa_target:            config.qa.target,
    qa_max:               config.qa.max,
  }
}

export async function getConfigMonths(team) {
  const { data, error } = await supabase
    .from('mis_config')
    .select('month')
    .eq('team', team)
    .order('month', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(r => r.month)
}

export async function getConfigForMonth(month, team) {
  const { data, error } = await supabase
    .from('mis_config')
    .select('*')
    .eq('month', month)
    .eq('team', team)
    .limit(1)
  if (error) throw new Error(error.message)
  if (!data || !data.length) return null
  return rowToConfig(data[0], team)
}

export async function getConfig(team) {
  const { data, error } = await supabase
    .from('mis_config')
    .select('*')
    .eq('team', team)
    .order('month', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    return { month: new Date().toISOString().slice(0, 7), ...TEAM_DEFS[team].defaultConfig }
  }
  return rowToConfig(data[0], team)
}

export async function saveConfig(config, team) {
  const { error } = await supabase
    .from('mis_config')
    .upsert(configToRow(config, team), { onConflict: 'month,team' })
  if (error) throw new Error(error.message)
  return config
}

// ── Team / Scores ─────────────────────────────────────────────────────────────

function rowToGuide(row, team) {
  const { metricDefs, hasChannel } = TEAM_DEFS[team]
  const guide = {
    id: row.id,
    name: row.guide_name,
    email: row.guide_email,
    days: row.accountable_days != null ? String(row.accountable_days) : '',
    tam_role: row.tam_role || 'TAM 1',
  }
  if (hasChannel) guide.channel = row.channel || 'voice'
  for (const def of metricDefs) {
    guide[def.key] = row[def.key] != null ? String(row[def.key]) : ''
    if (def.entryMode === 'perday') guide[`${def.key}Mode`] = 'perday'
  }
  return guide
}

function guideToRow(guide, month, team) {
  const { metricDefs } = TEAM_DEFS[team]
  const days = parseFloat(guide.days)
  const row = {
    month,
    guide_name:       guide.name || '',
    guide_email:      guide.email || '',
    channel:          guide.channel || 'voice',
    accountable_days: isNaN(days) ? null : Math.round(days * 10) / 10,
    team,
    tam_role:         guide.tam_role || 'TAM 1',
    published:        true,
  }
  for (const def of metricDefs) {
    if (def.entryMode === 'perday') {
      const val = guide[`${def.key}Mode`] === 'total' && !isNaN(days) && days > 0
        ? parseFloat(guide[def.key]) / days
        : parseFloat(guide[def.key])
      row[def.key] = isNaN(val) ? null : val
    } else {
      const val = parseFloat(guide[def.key])
      row[def.key] = isNaN(val) ? null : val
    }
  }
  if (guide.id) row.id = guide.id
  return row
}

export async function getTeam(month, team) {
  const { data, error } = await supabase
    .from('mis_scores')
    .select('*')
    .eq('month', month)
    .eq('team', team)
    .order('guide_name')
  if (error) throw new Error(error.message)
  return { month, guides: data.map(row => rowToGuide(row, team)) }
}

// Returns an updated guides array with IDs assigned from newly inserted rows.
export async function saveTeam(month, team, guides) {
  if (!guides.length) return guides
  const rows = guides.map(g => guideToRow(g, month, team))
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
    const newNames = insertIndices.map(idx => guides[idx].name).filter(Boolean)
    if (newNames.length) ensureGuideCredentials(newNames).catch(() => {})
    return updated
  }
  const namedGuides = guides.filter(g => g.name && !g.id).map(g => g.name)
  if (namedGuides.length) ensureGuideCredentials(namedGuides).catch(() => {})
  return guides
}

// ── Guides roster ─────────────────────────────────────────────────────────────

export async function getGuides(team) {
  let query = supabase.from('guides').select('*').order('name')
  if (team) query = query.eq('team', team)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function getGuidesWithHistory(team) {
  const guidesQuery = team
    ? supabase.from('guides').select('*').eq('team', team).order('name')
    : supabase.from('guides').select('*').order('name')
  const [guidesResult, scoresResult] = await Promise.all([
    guidesQuery,
    supabase.from('mis_scores').select('guide_name').neq('guide_name', ''),
  ])
  if (guidesResult.error) throw new Error(guidesResult.error.message)
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  const namesWithHistory = new Set(scoresResult.data.map(r => r.guide_name))
  return guidesResult.data.map(g => ({ ...g, hasHistory: namesWithHistory.has(g.name) }))
}

export async function addGuide({ name, channel, team = 'pss', tamRole = 'TAM 1' }) {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Name is required.')
  const { error } = await supabase
    .from('guides')
    .insert({ name: trimmedName, channel: channel || 'voice', team, tam_role: tamRole })
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

// ── QA Reviews ────────────────────────────────────────────────────────────────

export async function getQaReviews(month, team) {
  const { data, error } = await supabase
    .from('qa_reviews')
    .select('*')
    .eq('month', month)
    .eq('team', team)
    .order('guide_name')
    .order('review_date')
  if (error) throw new Error(error.message)
  return data
}

export async function addQaReview({ guideName, score, reviewDate, team }) {
  const month = reviewDate.slice(0, 7)
  const { data, error } = await supabase
    .from('qa_reviews')
    .insert({ guide_name: guideName, score, review_date: reviewDate, month, team })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  await syncQaAverage(guideName, month, team)
  return data.id
}

export async function updateQaReview(id, guideName, month, { score, reviewDate }, team) {
  const newMonth = reviewDate.slice(0, 7)
  const { error } = await supabase
    .from('qa_reviews')
    .update({ score, review_date: reviewDate, month: newMonth })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await syncQaAverage(guideName, newMonth, team)
  if (newMonth !== month) await syncQaAverage(guideName, month, team)
}

export async function deleteQaReview(id, guideName, month, team) {
  const { error } = await supabase.from('qa_reviews').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await syncQaAverage(guideName, month, team)
}

async function syncQaAverage(guideName, month, team) {
  const teamDef = TEAM_DEFS[team]
  if (teamDef.qaNotInMis) return
  const { data, error } = await supabase
    .from('qa_reviews')
    .select('score')
    .eq('guide_name', guideName)
    .eq('month', month)
    .eq('team', team)
  if (error) return
  const avg = data.length
    ? Math.round(data.reduce((s, r) => s + Number(r.score), 0) / data.length * 100) / 100
    : null
  await supabase
    .from('mis_scores')
    .update({ [teamDef.qaMetricKey]: avg })
    .eq('guide_name', guideName)
    .eq('month', month)
    .eq('team', team)
}

// ── Tech Titans ───────────────────────────────────────────────────────────────

export async function getTechTitansData(months) {
  if (!months.length) return []
  const [scoresResult, configsResult] = await Promise.all([
    supabase.from('mis_scores').select('*').in('month', months).order('guide_name'),
    supabase.from('mis_config').select('*').in('month', months),
  ])
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  if (configsResult.error) throw new Error(configsResult.error.message)

  const configByMonthTeam = {}
  configsResult.data.forEach(row => {
    const t = row.team || 'pss'
    configByMonthTeam[`${row.month}:${t}`] = rowToConfig(row, t)
  })

  const guideMap = {}
  scoresResult.data.forEach(row => {
    if (!row.guide_name) return
    const team = row.team || 'pss'
    const { metricDefs } = TEAM_DEFS[team]
    if (!metricDefs.every(def => row[def.key] != null)) return
    const config = configByMonthTeam[`${row.month}:${team}`]
    if (!config) return
    const actuals = {}
    for (const def of metricDefs) actuals[def.key] = Number(row[def.key])
    const configByKey = resolveConfigByKey(metricDefs, config, row.channel, row.tam_role)
    const mis = calculateMISGeneric(actuals, configByKey, metricDefs)
    const misUnbound = calculateUnboundedMISGeneric(actuals, configByKey, metricDefs)
    if (!guideMap[row.guide_name]) {
      guideMap[row.guide_name] = { name: row.guide_name, team, channel: row.channel, months: {} }
    }
    guideMap[row.guide_name].months[row.month] = { ...misUnbound, boundedTotal: mis.total }
  })

  return Object.values(guideMap)
    .map(g => ({
      ...g,
      quarterTotal:        Math.round(Object.values(g.months).reduce((s, m) => s + m.total,        0) * 100) / 100,
      quarterTotalBounded: Math.round(Object.values(g.months).reduce((s, m) => s + m.boundedTotal, 0) * 100) / 100,
    }))
    .sort((a, b) => b.quarterTotalBounded - a.quarterTotalBounded || b.quarterTotal - a.quarterTotal)
}

export async function publishMonth(month) {
  const { error } = await supabase
    .from('mis_scores')
    .update({ published: true })
    .eq('month', month)
  if (error) throw new Error(error.message)
}

export async function clearMonthData(month, team) {
  let query = supabase.from('mis_scores').delete().eq('month', month)
  if (team) query = query.eq('team', team)
  const { error } = await query
  if (error) throw new Error(error.message)
}

// ── Archive / Trend ───────────────────────────────────────────────────────────

export async function getArchivedMonths(team) {
  let query = supabase.from('mis_scores').select('month').neq('guide_name', '')
  if (team) query = query.eq('team', team)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return [...new Set(data.map(r => r.month))].sort().reverse()
}

function computeAverages(results, metricDefs) {
  const valid = (results || []).filter(Boolean)
  if (!valid.length) return null
  const avg = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100
  const out = {
    total:    avg(valid.map(r => r.total)),
    passRate: Math.round(valid.filter(r => r.passing).length / valid.length * 100) / 100,
    count:    valid.length,
  }
  for (const def of metricDefs) {
    out[def.key]         = avg(valid.map(r => r.actuals[def.key]))
    out[`${def.key}Pts`] = avg(valid.map(r => r[def.key]))
  }
  return out
}

function scoresToArchiveData(month, rows, config, team) {
  const { metricDefs } = TEAM_DEFS[team]
  const guides = rows.map(row => rowToGuide(row, team))
  const results = rows.map(row => {
    if (row.accountable_days == null || !metricDefs.every(def => row[def.key] != null)) return null
    const actuals = {}
    for (const def of metricDefs) actuals[def.key] = Number(row[def.key])
    const configByKey = resolveConfigByKey(metricDefs, config, row.channel, row.tam_role)
    return {
      name: row.guide_name,
      channel: row.channel,
      actuals,
      ...calculateMISGeneric(actuals, configByKey, metricDefs),
    }
  })
  return { month, guides, results, averages: computeAverages(results, metricDefs), config }
}

export async function getArchivedMonth(month, team) {
  const [scoresResult, configResult] = await Promise.all([
    supabase.from('mis_scores').select('*').eq('month', month).eq('team', team).order('guide_name'),
    supabase.from('mis_config').select('*').eq('month', month).eq('team', team).limit(1),
  ])
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  if (configResult.error) throw new Error(configResult.error.message)
  const config = configResult.data.length ? rowToConfig(configResult.data[0], team) : null
  return scoresToArchiveData(month, scoresResult.data, config, team)
}

// ── Guide history (requires guide login) ─────────────────────────────────────

export async function getGuideHistory(guideName, team) {
  const resolvedTeam = (team && TEAM_DEFS[team]) ? team : 'pss'
  const { metricDefs } = TEAM_DEFS[resolvedTeam]
  const [scoresResult, configsResult] = await Promise.all([
    supabase.from('mis_scores').select('*').eq('guide_name', guideName).eq('team', resolvedTeam).eq('published', true).order('month'),
    supabase.from('mis_config').select('*').eq('team', resolvedTeam),
  ])
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  if (configsResult.error) throw new Error(configsResult.error.message)

  const configByMonth = {}
  configsResult.data.forEach(row => { configByMonth[row.month] = rowToConfig(row, resolvedTeam) })

  return scoresResult.data.map(row => {
    const config = configByMonth[row.month]
    if (!config || !metricDefs.every(def => row[def.key] != null)) return null
    const actuals = {}
    for (const def of metricDefs) actuals[def.key] = Number(row[def.key])
    const configByKey = resolveConfigByKey(metricDefs, config, row.channel, row.tam_role)
    const bounded = calculateMISGeneric(actuals, configByKey, metricDefs)
    const unbounded = calculateUnboundedMISGeneric(actuals, configByKey, metricDefs)
    return { month: row.month, channel: row.channel, tam_role: row.tam_role, actuals, ...bounded, unboundedTotal: unbounded.total }
  }).filter(Boolean)
}

// ── Activity Log ──────────────────────────────────────────────────────────────

export function logActivity({ username, team, action, month = null, details = null }) {
  supabase.from('activity_log').insert({ username, team, action, month, details }).then(() => {}).catch(() => {})
}

export async function getActivityLog(limit = 200) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data
}

// ── AI Analysis cache ─────────────────────────────────────────────────────────

export async function getAiAnalysis() {
  const { data, error } = await supabase
    .from('ai_analysis_cache')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function saveAiAnalysis(content, generatedBy) {
  const { error } = await supabase
    .from('ai_analysis_cache')
    .insert({ content, generated_by: generatedBy })
  if (error) throw new Error(error.message)
}

// ── Manager overview ──────────────────────────────────────────────────────────

export async function getTeamMonthlyAverages(team) {
  const [scoresResult, configsResult] = await Promise.all([
    supabase.from('mis_scores').select('*').eq('team', team).eq('published', true).order('month'),
    supabase.from('mis_config').select('*').eq('team', team),
  ])
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  if (configsResult.error) throw new Error(configsResult.error.message)

  const configByMonth = {}
  configsResult.data.forEach(row => { configByMonth[row.month] = rowToConfig(row, team) })

  const { metricDefs } = TEAM_DEFS[team]
  const byMonth = {}
  scoresResult.data.forEach(row => {
    if (!row.guide_name) return
    if (!byMonth[row.month]) byMonth[row.month] = []
    byMonth[row.month].push(row)
  })

  return Object.entries(byMonth)
    .map(([month, rows]) => {
      const config = configByMonth[month]
      if (!config) return null
      const pairs = rows.map(row => {
        if (!metricDefs.every(def => row[def.key] != null)) return null
        const actuals = {}
        for (const def of metricDefs) actuals[def.key] = Number(row[def.key])
        const configByKey = resolveConfigByKey(metricDefs, config, row.channel, row.tam_role)
        const mis = calculateMISGeneric(actuals, configByKey, metricDefs)
        return { mis, actuals, channel: row.channel || 'voice', tam_role: row.tam_role || 'TAM 1' }
      }).filter(Boolean)
      if (!pairs.length) return null
      const avg = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100
      const metrics = {}
      const avgTargets = {}
      for (const def of metricDefs) {
        metrics[def.key] = avg(pairs.map(p => p.actuals[def.key]))
        const targets = pairs.map(p => resolveConfigByKey(metricDefs, config, p.channel, p.tam_role)[def.configKey]?.target).filter(t => t != null)
        avgTargets[def.key] = targets.length ? avg(targets) : null
      }
      const teamDef = TEAM_DEFS[team]
      const breakdown = {}
      if (teamDef.hasChannel) {
        for (const p of pairs) breakdown[p.channel] = (breakdown[p.channel] || 0) + 1
      } else if (metricDefs.some(d => d.tamTargets)) {
        for (const p of pairs) breakdown[p.tam_role] = (breakdown[p.tam_role] || 0) + 1
      }
      return {
        month,
        avgMIS: avg(pairs.map(p => p.mis.total)),
        passRate: Math.round(pairs.filter(p => p.mis.passing).length / pairs.length * 100) / 100,
        guideCount: pairs.length,
        breakdown,
        metrics,
        avgTargets,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.month.localeCompare(b.month))
}
