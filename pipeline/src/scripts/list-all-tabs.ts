import 'dotenv/config'
import { batchUpdateSheet } from '../tools/google-sheets.js'

// Piggyback on getAccessToken by calling batchUpdateSheet with a no-op
// and checking if Sheets API is reachable. Instead, just call the fetch
// with the same auth used by google-sheets.ts functions.

const SHEET_ID = process.env.LEADS_SHEET_ID ?? ''

async function main() {
  // Use same service account loader as google-sheets.ts
  const saRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!saRaw) { console.error('GOOGLE_SERVICE_ACCOUNT_JSON not set'); process.exit(1) }

  const sa = JSON.parse(saRaw)
  const now = Math.floor(Date.now() / 1000)
  const { Buffer } = await import('buffer')

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(sa.private_key, 'base64url')
  const jwt = `${header}.${payload}.${sig}`

  const tokRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const tokData = await tokRes.json() as any
  const token = tokData.access_token

  if (!token) { console.error('No access token:', tokData); process.exit(1) }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json() as any
  console.log('All tabs in spreadsheet:')
  for (const s of data.sheets ?? []) {
    console.log(`  sheetId=${s.properties.sheetId}  title="${s.properties.title}"`)
  }
}

main().catch(e => console.error('Fatal:', e.message))
