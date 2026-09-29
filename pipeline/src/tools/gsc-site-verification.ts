// Google Site Verification API — lets WebCrew's own service account become
// the verified owner of a client's deployed site with ZERO client action
// (no OAuth handshake, no DNS access needed). This is what makes GSC setup
// fully automatable for a client site: DNS-based verification (what a
// "Domain property" needs) is impossible for us to automate on a domain we
// don't control, but FILE-based verification just needs us to be able to
// write a file into the site's own deployed output — which the pipeline
// already does for every client via github.ts's updateFile().
//
// Once verified this way, the SAME service account is automatically an
// owner in Search Console too (Site Verification and Search Console share
// verified-owner state) — so google-search-console.ts's calls (sitemap
// submit, search analytics) work immediately after, no separate GSC-side
// "add user" step required.
//
// Same JWT auth pattern as google-sheets.ts / google-search-console.ts.

const SITEVERIFICATION_BASE = 'https://www.googleapis.com/siteVerification/v1'

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
    console.error('[GSC-Verify] No service account — set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE')
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/siteverification',
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
    console.error('[GSC-Verify] Token exchange failed:', tokenData.error, tokenData.error_description)
    return null
  }
  return tokenData.access_token
}

/**
 * Get a verification token for a site (FILE method). The returned
 * `token` is the exact content that must be served at
 * `${siteUrl}/google{token}.html` before `completeFileVerification` is called.
 */
export async function getFileVerificationToken(siteUrl: string): Promise<string | null> {
  const accessToken = await getAccessToken()
  if (!accessToken) return null

  const res = await fetch(`${SITEVERIFICATION_BASE}/token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      site: { type: 'SITE', identifier: siteUrl },
      verificationMethod: 'FILE',
    }),
  })
  if (!res.ok) {
    console.error('[GSC-Verify] getFileVerificationToken failed:', res.status, await res.text())
    return null
  }
  const data = await res.json() as any
  // Google returns the token embedded in a filename like "google1234.html" —
  // callers need just the bare token to name the file / check verification.
  return data.token ?? null
}

/**
 * Finalize verification — call only after the token file is actually live
 * at ${siteUrl}/google{token}.html (Google fetches it to confirm ownership).
 */
export async function completeFileVerification(siteUrl: string): Promise<boolean> {
  const accessToken = await getAccessToken()
  if (!accessToken) return false

  const res = await fetch(`${SITEVERIFICATION_BASE}/webResource?verificationMethod=FILE`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ site: { type: 'SITE', identifier: siteUrl } }),
  })
  if (!res.ok) {
    console.error('[GSC-Verify] completeFileVerification failed:', res.status, await res.text())
    return false
  }
  return true
}

/** Check current verification state for a site — for idempotent re-runs. */
export async function isVerified(siteUrl: string): Promise<boolean> {
  const accessToken = await getAccessToken()
  if (!accessToken) return false

  const res = await fetch(`${SITEVERIFICATION_BASE}/webResource/${encodeURIComponent(siteUrl)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.ok
}
