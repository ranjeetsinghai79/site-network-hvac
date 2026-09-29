/**
 * delete-status-charts.ts — delete all embedded chart objects from Status sheet
 * Run: npx tsx --env-file=.env src/scripts/delete-status-charts.ts
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createSign } from 'crypto'

const SHEET = process.env.LEADS_SHEET_ID!

async function getToken(): Promise<string> {
  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  else sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE!), 'utf8'))
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')
  const sig = createSign('RSA-SHA256').update(header + '.' + claim).sign(sa.private_key, 'base64url')
  const jwt = header + '.' + claim + '.' + sig
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const d = await r.json() as any
  return d.access_token as string
}

async function main() {
  const token = await getToken()

  // Get sheet metadata
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}?includeGridData=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const meta = await metaRes.json() as any
  const statusSheet = meta.sheets?.find((s: any) => s.properties.title === 'Status')

  if (!statusSheet) { console.error('Status sheet not found'); process.exit(1) }

  const sheetId = statusSheet.properties.sheetId
  const charts: any[] = statusSheet.charts ?? []
  console.log(`Status sheetId: ${sheetId}`)
  console.log(`Found ${charts.length} embedded chart(s):`, charts.map((c: any) => c.chartId))

  if (charts.length === 0) { console.log('Nothing to delete.'); return }

  // Delete all charts
  const requests = charts.map((c: any) => ({
    deleteEmbeddedObject: { objectId: c.chartId }
  }))

  const delRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  )
  const delData = await delRes.json() as any
  if (delData.error) {
    console.error('Error deleting charts:', JSON.stringify(delData.error))
  } else {
    console.log(`Deleted ${charts.length} chart(s) from Status tab.`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
