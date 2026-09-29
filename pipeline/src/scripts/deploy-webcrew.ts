/**
 * Deploy webcrew/out to Cloudflare Pages via direct upload API.
 * Usage: npx tsx src/scripts/deploy-webcrew.ts
 */
import { createHash } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'
import * as dotenv from 'dotenv'
dotenv.config()

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const TOKEN      = process.env.CLOUDFLARE_TOKEN!
const PROJECT    = 'webcrew-landing-backup'
const OUT_DIR    = join(__dirname, '../../../webcrew/out')
const BASE_URL   = 'https://api.cloudflare.com/client/v4'

const authHeaders = () => ({ Authorization: `Bearer ${TOKEN}` })

function walkDir(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) files.push(...walkDir(full))
    else files.push(full)
  }
  return files
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

async function createProject() {
  const res = await fetch(`${BASE_URL}/accounts/${ACCOUNT_ID}/pages/projects`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: PROJECT, production_branch: 'main' }),
  })
  const json = await res.json() as any
  if (!res.ok) {
    const msg = json?.errors?.[0]?.message ?? ''
    if (msg.includes('already exists') || msg.includes('taken')) {
      console.log('Project already exists — continuing')
      return
    }
    throw new Error(`Create project failed: ${JSON.stringify(json.errors)}`)
  }
  console.log(`Project "${PROJECT}" created ✓`)
}

async function uploadFiles(fileMap: Map<string, Buffer>) {
  // CF Pages direct upload: chunk files (max 20MB per request, max 200 files)
  const CHUNK = 100
  const entries = [...fileMap.entries()]
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK)
    const form = new FormData()
    for (const [hash, buf] of chunk) {
      form.append(hash, new Blob([buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer]), hash)
    }
    const res = await fetch(
      `${BASE_URL}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/upload-assets`,
      { method: 'POST', headers: authHeaders(), body: form }
    )
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`upload-assets failed [chunk ${i}]: ${txt}`)
    }
    console.log(`  Uploaded chunk ${i + 1}–${Math.min(i + CHUNK, entries.length)} of ${entries.length}`)
  }
}

async function deploy(manifest: Record<string, string>) {
  const form = new FormData()
  form.append('manifest', new Blob([JSON.stringify(manifest)], { type: 'application/json' }), 'manifest.json')

  const res = await fetch(
    `${BASE_URL}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/deployments`,
    { method: 'POST', headers: authHeaders(), body: form }
  )
  const json = await res.json() as any
  if (!res.ok) throw new Error(`Deploy failed: ${JSON.stringify(json.errors ?? json)}`)

  const url = json.result?.url ?? `https://${PROJECT}.pages.dev`
  console.log(`\nDeployed ✓ → ${url}`)
  console.log(`Main URL  → https://${PROJECT}.pages.dev`)
  return url
}

async function main() {
  if (!ACCOUNT_ID || !TOKEN) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_TOKEN')
  console.log(`Deploying ${OUT_DIR} → CF Pages "${PROJECT}"`)

  await createProject()

  const files = walkDir(OUT_DIR)
  const manifest: Record<string, string> = {}
  const fileMap = new Map<string, Buffer>()

  for (const abs of files) {
    const rel  = '/' + relative(OUT_DIR, abs).replace(/\\/g, '/')
    const buf  = readFileSync(abs)
    const hash = sha256(buf)
    manifest[rel] = hash
    fileMap.set(hash, buf)
  }

  console.log(`${files.length} files, ${fileMap.size} unique blobs`)

  // Step 1: upload file blobs
  await uploadFiles(fileMap)

  // Step 2: create deployment with manifest
  await deploy(manifest)
}

main().catch(e => { console.error(e.message ?? e); process.exit(1) })
