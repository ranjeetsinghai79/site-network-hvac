export async function clearSheet(params: {
  spreadsheetId: string
  sheetName: string
}): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false
  const range = encodeURIComponent(`${params.sheetName}!A:Z`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${range}:clear`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) { console.error('[Sheets] clear failed:', await res.text()); return false }
  return true
}

export async function writeSheetRows(params: {
  spreadsheetId: string
  sheetName: string
  rows: string[][]
}): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false
  const range = encodeURIComponent(`${params.sheetName}!A1`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: params.rows }),
    }
  )
  if (!res.ok) { console.error('[Sheets] write failed:', await res.text()); return false }
  return true
}

export async function appendSheetRow(params: {
  spreadsheetId: string
  sheetName: string
  values: string[]
}): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false

  const range = `${params.sheetName}!A1`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [params.values] }),
  })

  if (!res.ok) {
    console.error('[Sheets] append failed:', await res.text())
    return false
  }
  return true
}

export async function appendSheetRows(params: {
  spreadsheetId: string
  sheetName: string
  rows: string[][]
}): Promise<boolean> {
  if (!params.rows.length) return true
  const token = await getAccessToken()
  if (!token) return false

  const range = `${params.sheetName}!A1`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: params.rows }),
  })

  if (!res.ok) {
    console.error('[Sheets] batch append failed:', await res.text())
    return false
  }
  return true
}

export async function readSheetRows(params: {
  spreadsheetId: string
  sheetName: string
  range?: string
}): Promise<string[][]> {
  const token = await getAccessToken()
  if (!token) return []
  const rangeSpec = encodeURIComponent(`${params.sheetName}!${params.range ?? 'A:T'}`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${rangeSpec}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) { console.error('[Sheets] read failed:', await res.text()); return [] }
  const data = await res.json() as any
  return data.values ?? []
}

export async function updateSheetCell(params: {
  spreadsheetId: string
  sheetName: string
  row: number
  col: number
  value: string
}): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) { console.error('[Sheets] cell update failed: no access token'); return false }
  const colLetter = String.fromCharCode(64 + params.col)
  const range = encodeURIComponent(`${params.sheetName}!${colLetter}${params.row}`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[params.value]] }),
    }
  )
  if (!res.ok) { console.error('[Sheets] cell update failed:', await res.text()); return false }
  return true
}

export async function getConditionalRuleCount(params: {
  spreadsheetId: string
  sheetId: number
}): Promise<number> {
  const token = await getAccessToken()
  if (!token) return 0
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}?fields=sheets(properties.sheetId,conditionalFormats)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return 0
  const data = await res.json() as any
  const sheet = data.sheets?.find((s: any) => s.properties.sheetId === params.sheetId)
  return sheet?.conditionalFormats?.length ?? 0
}

export async function batchUpdateSheet(params: {
  spreadsheetId: string
  requests: any[]
}): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: params.requests }),
    }
  )
  if (!res.ok) { console.error('[Sheets] batchUpdate failed:', await res.text()); return false }
  return true
}

export async function writeRangeValues(params: {
  spreadsheetId: string
  range: string        // e.g. "Status!P1:Y30"
  values: (string | number)[][]
}): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false
  const enc = encodeURIComponent(params.range)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${enc}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: params.values }),
    }
  )
  if (!res.ok) { console.error('[Sheets] writeRange failed:', await res.text()); return false }
  return true
}

export async function clearRange(params: {
  spreadsheetId: string
  range: string
}): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false
  const enc = encodeURIComponent(params.range)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${enc}:clear`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) { console.error('[Sheets] clearRange failed:', await res.text()); return false }
  return true
}

export async function listSheetTabs(params: {
  spreadsheetId: string
}): Promise<Array<{ title: string; sheetId: number }>> {
  const token = await getAccessToken()
  if (!token) return []
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return []
  const data = await res.json() as any
  return (data.sheets ?? []).map((s: any) => ({
    title:   s.properties.title as string,
    sheetId: s.properties.sheetId as number,
  }))
}

export async function getSheetId(params: {
  spreadsheetId: string
  sheetName: string
}): Promise<number | null> {
  const token = await getAccessToken()
  if (!token) return null
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return null
  const data = await res.json() as any
  const sheet = data.sheets?.find((s: any) => s.properties.title === params.sheetName)
  return sheet?.properties?.sheetId ?? null
}

async function loadServiceAccount(): Promise<any | null> {
  // Prefer JSON string in env, fall back to file path
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
    console.error('[Sheets] No service account — set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE')
    return null
  }

  const now = Math.floor(Date.now() / 1000)

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
  const signature = sign.sign(sa.private_key, 'base64url')

  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json() as any
  return tokenData.access_token || null
}
