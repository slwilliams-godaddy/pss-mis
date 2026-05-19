const GOCAAS_URL = 'https://caas-gocode-prod.caas-prod.prod.onkatana.net/v1/messages'

export async function callGoCaaS(prompt, { signal } = {}) {
  const apiKey = import.meta.env.VITE_GOCAAS_API_KEY
  if (!apiKey) throw new Error('VITE_GOCAAS_API_KEY not configured')
  const response = await fetch(GOCAAS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `GoCaaS error ${response.status}`)
  }
  const data = await response.json()
  const text = data.content?.[0]?.text
  if (!text) throw new Error('No response from AI')
  return text
}
