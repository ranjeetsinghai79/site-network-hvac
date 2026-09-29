// Minimal Google Sheets reader for the local dashboard (service-account JWT, read-only scope).
import fs from "fs"
import path from "path"
import { createSign } from "crypto"

// Spreadsheet from the user's link; override with LEADS_SHEET_ID.
export const SHEET_ID = process.env.LEADS_SHEET_ID || "1wwZX7eriuA0i37t6_VOetkmHcS7YKiHXI2DYj7gfa9A"

function loadServiceAccount(): { client_email: string; private_key: string } {
  const file = path.resolve(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "../pipeline/service-account.json")
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

let cached: { token: string; exp: number } | null = null

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cached && cached.exp > now + 60) return cached.token
  const sa = loadServiceAccount()
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url")
  const sig = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(sa.private_key, "base64url")
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${payload}.${sig}`,
  })
  const data = (await res.json()) as { access_token?: string; error_description?: string }
  if (!data.access_token) throw new Error(`Google auth failed: ${data.error_description ?? res.status}`)
  cached = { token: data.access_token, exp: now + 3600 }
  return data.access_token
}

export async function listTabs(): Promise<string[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${await accessToken()}` } },
  )
  if (!res.ok) throw new Error(`Sheets tab list failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { sheets: { properties: { title: string } }[] }
  return data.sheets.map(s => s.properties.title)
}

export async function readTab(tab: string): Promise<string[][]> {
  const range = encodeURIComponent(`${tab}!A:V`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?majorDimension=ROWS`,
    { headers: { Authorization: `Bearer ${await accessToken()}` } },
  )
  if (!res.ok) throw new Error(`Sheets read "${tab}" failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { values?: string[][] }).values ?? []
}
