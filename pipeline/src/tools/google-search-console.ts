// Google Search Console API — same service-account JWT pattern as
// google-sheets.ts / google-my-business.ts, scope 'webmasters' instead.
//
// Two one-time manual steps before any of this works (neither can be done
// from here — no gcloud access to this project from this machine, see
// project_vertex_billing.md):
//   1. Enable the Search Console API on the GCP project the service account
//      belongs to: console.cloud.google.com/apis/library/searchconsole.googleapis.com
//   2. Add the service account's client_email as a user with Full permission
//      on the webcrew.app property: search.google.com/search-console →
//      Settings → Users and permissions → Add user
//
// "Request indexing" for a normal page has no supported API — that's
// deliberately not implemented here. Google's separate Indexing API is
// contractually restricted to JobPosting/BroadcastEvent pages only; using it
// for ordinary marketing pages is against its terms and isn't reliable. Use
// the GSC UI's "Request Indexing" button for that instead.

const WEBMASTERS_BASE = 'https://www.googleapis.com/webmasters/v3'
const SEARCHCONSOLE_BASE = 'https://searchconsole.googleapis.com/v1'

async function loadServiceAccount(): Promise<any | null> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try { return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) } catch { return null }
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    try { return JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE), 'utf8')) } catch { return null }
  }
  return null
}

async function getAccessToken(): Promise<string | null> {
  const sa = await loadServiceAccount()
  if (!sa) {
    console.error('[GSC] No service account — set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE')
    return null
  }

  const now = Math.floor(Date.now() / 1000)

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(sa.private_key, 'base64url')

  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json() as any
  if (!tokenData.access_token) {
    console.error('[GSC] Token exchange failed:', tokenData.error, tokenData.error_description)
    return null
  }
  return tokenData.access_token
}

/** List properties (sites) this service account can see — good first smoke test. */
export async function listSites(): Promise<any[]> {
  const token = await getAccessToken()
  if (!token) return []
  const res = await fetch(`${WEBMASTERS_BASE}/sites`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.error('[GSC] listSites failed:', res.status, await res.text())
    return []
  }
  const data = await res.json() as any
  return data.siteEntry ?? []
}

/** Submit (register) a sitemap for a verified property. siteUrl e.g. 'https://webcrew.app/'. */
export async function submitSitemap(siteUrl: string, sitemapUrl: string): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false
  const res = await fetch(
    `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) {
    console.error('[GSC] submitSitemap failed:', res.status, await res.text())
    return false
  }
  return true
}

/** List sitemaps currently registered for a property, with last-fetch/error status. */
export async function listSitemaps(siteUrl: string): Promise<any[]> {
  const token = await getAccessToken()
  if (!token) return []
  const res = await fetch(
    `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) {
    console.error('[GSC] listSitemaps failed:', res.status, await res.text())
    return []
  }
  const data = await res.json() as any
  return data.sitemap ?? []
}

/** Read-only indexing status check for one URL — NOT a request-indexing call. */
export async function inspectUrl(siteUrl: string, inspectionUrl: string): Promise<any | null> {
  const token = await getAccessToken()
  if (!token) return null
  const res = await fetch(`${SEARCHCONSOLE_BASE}/urlInspection/index:inspect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl, inspectionUrl }),
  })
  if (!res.ok) {
    console.error('[GSC] inspectUrl failed:', res.status, await res.text())
    return null
  }
  return res.json()
}

/**
 * Query search performance (queries, clicks, impressions, position).
 * Will return an empty rows array until the site has real search traffic —
 * that's expected on a brand-new property, not a bug.
 */
export async function getSearchAnalytics(params: {
  siteUrl: string
  startDate: string // 'YYYY-MM-DD'
  endDate: string
  dimensions?: ('query' | 'page' | 'country' | 'device' | 'date')[]
  rowLimit?: number
}): Promise<any[]> {
  const token = await getAccessToken()
  if (!token) return []
  const res = await fetch(
    `${WEBMASTERS_BASE}/sites/${encodeURIComponent(params.siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: params.dimensions ?? ['query'],
        rowLimit: params.rowLimit ?? 100,
      }),
    }
  )
  if (!res.ok) {
    console.error('[GSC] getSearchAnalytics failed:', res.status, await res.text())
    return []
  }
  const data = await res.json() as any
  return data.rows ?? []
}
