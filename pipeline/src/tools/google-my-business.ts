const GMB_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1'
const GMB_INFO_BASE = 'https://mybusinessinformation.googleapis.com/v1'
const GMB_REVIEWS_BASE = 'https://mybusiness.googleapis.com/v4'

// Thrown when Google returns 403 on a GBP call — distinct from transient
// failures (quota, 5xx) so callers can tell "client revoked our Manager
// access" apart from "try again later" and clear stored credentials.
export class GbpAccessRevokedError extends Error {
  constructor(detail: string) {
    super(`GBP access revoked or missing: ${detail}`)
    this.name = 'GbpAccessRevokedError'
  }
}

async function throwIfRevoked(res: Response): Promise<void> {
  if (res.status === 403) {
    const body = await res.text().catch(() => '')
    throw new GbpAccessRevokedError(body.slice(0, 300))
  }
}

function loadServiceAccount(): any | null {
  // GBP_SERVICE_ACCOUNT_* takes priority — dedicated SA (webcrew-gbp@webcrew-501006)
  // added as Manager on the Business Profile. Falls back to the shared
  // GOOGLE_SERVICE_ACCOUNT_* (used for Sheets etc.) only if unset.
  if (process.env.GBP_SERVICE_ACCOUNT_JSON) {
    try { return JSON.parse(process.env.GBP_SERVICE_ACCOUNT_JSON) } catch { return null }
  }
  if (process.env.GBP_SERVICE_ACCOUNT_FILE) {
    const { readFileSync } = require('fs')
    const { resolve } = require('path')
    try { return JSON.parse(readFileSync(resolve(process.env.GBP_SERVICE_ACCOUNT_FILE), 'utf8')) } catch { return null }
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try { return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) } catch { return null }
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    const { readFileSync } = require('fs')
    const { resolve } = require('path')
    try { return JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE), 'utf8')) } catch { return null }
  }
  return null
}

async function getAccessToken(): Promise<string | null> {
  const sa = loadServiceAccount()
  if (!sa) return null
  const now = Math.floor(Date.now() / 1000)
  const { createSign } = await import('crypto')

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/business.manage',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(sa.private_key, 'base64url')
  const jwt = `${header}.${payload}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json() as any
  return data.access_token || null
}

export async function listAccounts(): Promise<any[]> {
  const token = await getAccessToken()
  if (!token) return []

  const res = await fetch(
    `${GMB_BASE}/accounts`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json() as any
  return data.accounts || []
}

export async function listLocations(accountId: string): Promise<any[]> {
  const token = await getAccessToken()
  if (!token) return []

  const res = await fetch(
    `${GMB_INFO_BASE}/accounts/${accountId}/locations?readMask=name,title,phoneNumbers,websiteUri`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json() as any
  return data.locations || []
}

export async function createPost(params: {
  accountId: string
  locationId: string
  summary: string
  callToActionUrl?: string
}): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false

  const res = await fetch(
    `${GMB_REVIEWS_BASE}/accounts/${params.accountId}/locations/${params.locationId}/localPosts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        languageCode: 'en',
        summary: params.summary,
        topicType: 'STANDARD',
        ...(params.callToActionUrl && {
          callToAction: { actionType: 'LEARN_MORE', url: params.callToActionUrl },
        }),
      }),
    }
  )
  await throwIfRevoked(res)
  return res.ok
}

export async function listReviews(params: {
  accountId: string
  locationId: string
}): Promise<any[]> {
  const token = await getAccessToken()
  if (!token) return []

  const res = await fetch(
    `${GMB_REVIEWS_BASE}/accounts/${params.accountId}/locations/${params.locationId}/reviews`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  await throwIfRevoked(res)
  const data = await res.json() as any
  return data.reviews || []
}

export async function replyToReview(params: {
  accountId: string
  locationId: string
  reviewId: string
  replyText: string
}): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false

  const res = await fetch(
    `${GMB_REVIEWS_BASE}/accounts/${params.accountId}/locations/${params.locationId}/reviews/${params.reviewId}/reply`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment: params.replyText }),
    }
  )
  await throwIfRevoked(res)
  return res.ok
}
