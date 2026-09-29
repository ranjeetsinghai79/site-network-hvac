/**
 * Repairs the 4 stuck 'built' leads by:
 * 1. Adding .github/workflows/deploy.yml to each repo
 * 2. Setting CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID as repo secrets
 * 3. Creating the CF Pages project (no GitHub App needed)
 * 4. A push to trigger the GH Actions deploy
 *
 * Run after setting a valid CLOUDFLARE_TOKEN in pipeline/.env
 */
import { config } from 'dotenv'
config()
import pg from 'pg'
import { seal } from 'tweetsodium'

const GH_TOKEN = process.env.GITHUB_TOKEN!
const CF_TOKEN = process.env.CLOUDFLARE_TOKEN!
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const GH_API = 'https://api.github.com'
const CF_API = 'https://api.cloudflare.com/client/v4'

function ghHeaders() {
  return {
    Authorization: `token ${GH_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json',
  }
}

function cfHeaders() {
  return {
    Authorization: `Bearer ${CF_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function buildWorkflow(templateDir: string, projectName: string) {
  return `name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install deps
        run: npm install --legacy-peer-deps
      - name: Build
        run: npm run build --workspace=${templateDir}
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy ${templateDir}/out --project-name=${projectName} --commit-dirty=true
`
}

async function getPublicKey(owner: string, repo: string) {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/actions/secrets/public-key`, { headers: ghHeaders() })
  if (!res.ok) throw new Error(`public key fetch failed: ${await res.text()}`)
  return res.json() as Promise<{ key_id: string; key: string }>
}

async function setSecret(owner: string, repo: string, name: string, value: string) {
  const pk = await getPublicKey(owner, repo)
  const keyBytes = Buffer.from(pk.key, 'base64')
  const msgBytes = Buffer.from(value, 'utf8')
  const encrypted = Buffer.from(seal(msgBytes, keyBytes)).toString('base64')
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({ encrypted_value: encrypted, key_id: pk.key_id }),
  })
  if (!res.ok && res.status !== 204) throw new Error(`set secret failed: ${await res.text()}`)
  console.log(`  ✓ secret ${name}`)
}

async function upsertFile(owner: string, repo: string, path: string, content: string, message: string) {
  const getRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, { headers: ghHeaders() })
  const sha = getRes.ok ? (await getRes.json() as any).sha : undefined
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), ...(sha ? { sha } : {}) }),
  })
  if (!res.ok) throw new Error(`upsert file failed: ${await res.text()}`)
  console.log(`  ✓ ${path} committed`)
}

async function createCfProject(projectName: string) {
  const res = await fetch(`${CF_API}/accounts/${CF_ACCOUNT_ID}/pages/projects`, {
    method: 'POST',
    headers: cfHeaders(),
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
      deployment_configs: {
        production: {
          compatibility_date: '2024-09-23',
          compatibility_flags: ['nodejs_compat'],
        },
      },
    }),
  })
  const body = await res.text()
  if (!res.ok) {
    if (body.includes('already exists') || body.includes('taken')) {
      console.log(`  ✓ CF project "${projectName}" already exists`)
      return
    }
    throw new Error(`CF project creation failed: ${body}`)
  }
  console.log(`  ✓ CF project "${projectName}" created`)
}

async function main() {
  if (!CF_TOKEN || !CF_ACCOUNT_ID) {
    console.error('❌ CLOUDFLARE_TOKEN or CLOUDFLARE_ACCOUNT_ID not set in .env')
    process.exit(1)
  }

  // Verify CF token
  const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: cfHeaders(),
  })
  const verify = await verifyRes.json() as any
  if (!verify.success) {
    console.error('❌ CLOUDFLARE_TOKEN is invalid:', verify.errors)
    console.error('\nCreate a new token at: https://dash.cloudflare.com/profile/api-tokens')
    console.error('Use "Edit Cloudflare Workers" template + add Cloudflare Pages:Edit permission')
    process.exit(1)
  }
  console.log(`✓ CF token valid — status: ${verify.result?.status}\n`)

  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const { rows } = await db.query(
    "SELECT id, name, github_repo, brand_data FROM leads WHERE status = 'built' ORDER BY created_at DESC"
  )

  for (const lead of rows) {
    const repoUrl: string = lead.github_repo
    const templateDir: string = lead.brand_data?._templateDir ?? 'templates/hvac'
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) { console.warn(`Skipping ${lead.name} — can't parse repo URL`); continue }
    const [, owner, repo] = match
    const projectName = repo.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 63)

    console.log(`\n─── ${lead.name} ───`)
    console.log(`  repo: ${owner}/${repo}`)
    console.log(`  project: ${projectName}`)

    try {
      // 1. Add GH Actions workflow
      await upsertFile(owner, repo, '.github/workflows/deploy.yml', buildWorkflow(templateDir, projectName), 'ci: Cloudflare Pages deploy via Wrangler')

      // 2. Set CF secrets
      await setSecret(owner, repo, 'CLOUDFLARE_API_TOKEN', CF_TOKEN)
      await setSecret(owner, repo, 'CLOUDFLARE_ACCOUNT_ID', CF_ACCOUNT_ID)

      // 3. Create CF Pages project
      await createCfProject(projectName)

      console.log(`  🚀 GH Actions will now build + deploy → https://${projectName}.pages.dev`)
    } catch (e: any) {
      console.error(`  ✗ ${e.message}`)
    }
  }

  await db.end()
  console.log('\nDone! GitHub Actions will deploy each site in ~4-5 min.')
  console.log('Check runs at: https://github.com/ranjeetsinghai79?tab=repositories')
}

main()
