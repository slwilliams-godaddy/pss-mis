const SP_BASE = 'https://secureservernet.sharepoint.com/teams/casteam/_api'
const SUPERVISOR_GROUP = 'MIS_Supervisors'

// ── Request digest (required for all write operations) ───────────────────────

let _digest = null
let _digestExpiry = 0

async function getDigest() {
  if (_digest && Date.now() < _digestExpiry) return _digest
  const res = await spFetch(`${SP_BASE}/contextinfo`, {
    method: 'POST',
    headers: { Accept: 'application/json;odata=nometadata' },
  })
  const data = await res.json()
  _digest = data.FormDigestValue
  _digestExpiry = Date.now() + 25 * 60 * 1000
  return _digest
}

// ── Base fetch wrapper ────────────────────────────────────────────────────────

async function spFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=nometadata',
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SharePoint API error ${res.status}: ${text}`)
  }
  return res
}

async function spGet(url) {
  const res = await spFetch(url)
  const data = await res.json()
  return data.value !== undefined ? data.value : data
}

async function spPost(url, body) {
  const digest = await getDigest()
  const res = await spFetch(url, {
    method: 'POST',
    headers: { 'X-RequestDigest': digest },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function spPatch(url, body) {
  const digest = await getDigest()
  await spFetch(url, {
    method: 'POST',
    headers: {
      'X-RequestDigest': digest,
      'X-HTTP-Method': 'MERGE',
      'If-Match': '*',
    },
    body: JSON.stringify(body),
  })
}

async function spDelete(url) {
  const digest = await getDigest()
  await spFetch(url, {
    method: 'POST',
    headers: {
      'X-RequestDigest': digest,
      'X-HTTP-Method': 'DELETE',
      'If-Match': '*',
    },
  })
}

function listUrl(listName) {
  return `${SP_BASE}/web/lists/getbytitle('${listName}')/items`
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function getCurrentUser() {
  const data = await spGet(`${SP_BASE}/web/currentUser?$select=Title,Email,LoginName`)
  return { name: data.Title, email: data.Email?.toLowerCase(), loginName: data.LoginName }
}

export async function isSupervisor(email) {
  try {
    const users = await spGet(
      `${SP_BASE}/web/sitegroups/getbyname('${SUPERVISOR_GROUP}')/users?$select=Email`
    )
    return users.some(u => u.Email?.toLowerCase() === email?.toLowerCase())
  } catch {
    return false
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getConfig(month) {
  const items = await spGet(
    `${listUrl('MIS_Config')}?$filter=Title eq '${month}'&$top=1`
  )
  if (!items.length) return null
  const r = items[0]
  return {
    id: r.Id,
    month: r.Title,
    cpd:          { min: r.CPDMin,          target: r.CPDTarget,          max: r.CPDMax          },
    gcrVoice:     { min: r.GCRVoiceMin,     target: r.GCRVoiceTarget,     max: r.GCRVoiceMax     },
    gcrMessaging: { min: r.GCRMessagingMin, target: r.GCRMessagingTarget, max: r.GCRMessagingMax },
    qa:           { min: r.QAMin,           target: r.QATarget,           max: r.QAMax           },
  }
}

export async function saveConfig(config) {
  const body = {
    Title:               config.month,
    CPDMin:              config.cpd.min,
    CPDTarget:           config.cpd.target,
    CPDMax:              config.cpd.max,
    GCRVoiceMin:         config.gcrVoice.min,
    GCRVoiceTarget:      config.gcrVoice.target,
    GCRVoiceMax:         config.gcrVoice.max,
    GCRMessagingMin:     config.gcrMessaging.min,
    GCRMessagingTarget:  config.gcrMessaging.target,
    GCRMessagingMax:     config.gcrMessaging.max,
    QAMin:               config.qa.min,
    QATarget:            config.qa.target,
    QAMax:               config.qa.max,
  }
  if (config.id) {
    await spPatch(`${listUrl('MIS_Config')}(${config.id})`, body)
    return { ...config }
  } else {
    const created = await spPost(listUrl('MIS_Config'), body)
    return { ...config, id: created.Id }
  }
}

export async function getConfigMonths() {
  const items = await spGet(`${listUrl('MIS_Config')}?$select=Title&$orderby=Title desc`)
  return items.map(r => r.Title)
}

// ── Scores ────────────────────────────────────────────────────────────────────

function rowToScore(r) {
  return {
    id:             r.Id,
    month:          r.Month,
    name:           r.GuideName,
    email:          r.GuideEmail,
    channel:        r.Channel,
    cpdMode:        r.CPDMode || 'perday',
    cpd:            String(r.CPD ?? ''),
    gcrMode:        r.GCRMode || 'perday',
    gcr:            String(r.GCR ?? ''),
    qa:             String(r.QA ?? ''),
    days:           String(r.AccountableDays ?? ''),
    published:      r.Published ?? false,
    monthClosed:    r.MonthClosed ?? false,
  }
}

function scoreToBody(row, month) {
  return {
    Month:           month || row.month,
    GuideName:       row.name || '',
    GuideEmail:      row.email || '',
    Channel:         row.channel || 'voice',
    CPDMode:         row.cpdMode || 'perday',
    CPD:             parseFloat(row.cpd) || null,
    GCRMode:         row.gcrMode || 'perday',
    GCR:             parseFloat(row.gcr) || null,
    QA:              parseFloat(row.qa) || null,
    AccountableDays: parseFloat(row.days) || null,
    Published:       row.published ?? false,
    MonthClosed:     row.monthClosed ?? false,
  }
}

export async function getTeamScores(month) {
  const items = await spGet(
    `${listUrl('MIS_Scores')}?$filter=Month eq '${month}'&$orderby=GuideName`
  )
  return items.map(rowToScore)
}

export async function getMyScores(email) {
  const items = await spGet(
    `${listUrl('MIS_Scores')}?$filter=GuideEmail eq '${email}' and Published eq 1&$orderby=Month desc`
  )
  return items.map(rowToScore)
}

export async function saveScore(row, month) {
  const body = scoreToBody(row, month)
  if (row.id) {
    await spPatch(`${listUrl('MIS_Scores')}(${row.id})`, body)
    return { ...row }
  } else {
    const created = await spPost(listUrl('MIS_Scores'), body)
    return { ...row, id: created.Id }
  }
}

export async function deleteScore(id) {
  await spDelete(`${listUrl('MIS_Scores')}(${id})`)
}

export async function publishScore(id, published) {
  await spPatch(`${listUrl('MIS_Scores')}(${id})`, { Published: published })
}

export async function closeMonth(month) {
  const items = await spGet(
    `${listUrl('MIS_Scores')}?$filter=Month eq '${month}'&$select=Id`
  )
  await Promise.all(items.map(r =>
    spPatch(`${listUrl('MIS_Scores')}(${r.Id})`, { MonthClosed: true })
  ))
}

export async function getArchivedMonths() {
  const items = await spGet(
    `${listUrl('MIS_Scores')}?$select=Month&$filter=MonthClosed eq 1`
  )
  const months = [...new Set(items.map(r => r.Month))].sort().reverse()
  return months
}

// ── Guides roster ─────────────────────────────────────────────────────────────

export async function getGuides() {
  const items = await spGet(
    `${listUrl('MIS_Guides')}?$filter=Active eq 1&$orderby=Title`
  )
  return items.map(r => ({
    id:      r.Id,
    name:    r.Title,
    email:   r.GuideEmail,
    channel: r.Channel || 'voice',
    active:  r.Active ?? true,
  }))
}

export async function saveGuide(guide) {
  const body = {
    Title:      guide.name,
    GuideEmail: guide.email,
    Channel:    guide.channel || 'voice',
    Active:     guide.active ?? true,
  }
  if (guide.id) {
    await spPatch(`${listUrl('MIS_Guides')}(${guide.id})`, body)
    return { ...guide }
  } else {
    const created = await spPost(listUrl('MIS_Guides'), body)
    return { ...guide, id: created.Id }
  }
}

export async function deleteGuide(id) {
  await spDelete(`${listUrl('MIS_Guides')}(${id})`)
}
