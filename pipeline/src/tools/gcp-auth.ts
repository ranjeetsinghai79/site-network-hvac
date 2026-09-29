import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

interface TokenCache { value: string; expiresAt: number }
let cachedToken: TokenCache | null = null

function loadSA(): any {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  }
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE
  if (file) return JSON.parse(readFileSync(file, 'utf8'))
  return null
}

export async function getVertexToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value

  const sa = loadSA()
  if (!sa) return null

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  })).toString('base64url')

  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(sa.private_key, 'base64url')
  const jwt = `${header}.${payload}.${signature}`

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json() as any
  if (!data.access_token) return null

  cachedToken = { value: data.access_token, expiresAt: now + 3500 }
  return data.access_token
}

// Bootstrap GOOGLE_APPLICATION_CREDENTIALS for the @google/genai SDK ADC path.
// Call once before initialising GoogleGenAI with vertexai:true.
export function bootstrapADC(): void {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return
  if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_SERVICE_ACCOUNT_FILE
    return
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const tmp = join(tmpdir(), 'gcp-sa-vertex.json')
    writeFileSync(tmp, process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'utf8')
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tmp
  }
}
