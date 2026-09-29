/**
 * Sets CF secrets on failed site repos and re-triggers deploy workflow.
 * Run: npx tsx pipeline/src/scripts/fix-failed-repos.ts
 */
import { config } from 'dotenv'
config({ path: 'pipeline/.env' })
import { setRepoSecret } from '../tools/github.js'

const OWNER = 'ranjeetsinghai79'
const FAILED_REPOS = [
  'site-clearwater-dentistry',
  'site-happy-junk-removal',
  'site-luxury-homes-in-riverside',
  'site-san-jose-daycare',
  'site-ocd-cleaners-house-cleaning-service-san-',
]

// Push updated workflow file (with workflow_dispatch trigger) — this also re-triggers via push event
async function pushUpdatedWorkflow(repo: string) {
  const ghToken = process.env.GITHUB_TOKEN!

  // Get current workflow SHA
  const getRes = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/contents/.github/workflows/deploy.yml`, {
    headers: { Authorization: `token ${ghToken}`, 'X-GitHub-Api-Version': '2022-11-28' },
  })
  if (!getRes.ok) return `get-failed (${getRes.status})`
  const current = await getRes.json() as any
  const sha = current.sha

  // Detect template dir from current workflow content
  const existingContent = Buffer.from(current.content, 'base64').toString('utf8')
  const templateMatch = existingContent.match(/npm run build --workspace=(\S+)/)
  const templateDir = templateMatch?.[1] ?? 'templates/hvac'
  const projectMatch = existingContent.match(/--project-name=(\S+)\s/)
  const projectName = projectMatch?.[1] ?? repo

  const updatedWorkflow = `name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
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

  const putRes = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/contents/.github/workflows/deploy.yml`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${ghToken}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: 'ci: add workflow_dispatch trigger + retry deploy',
      content: Buffer.from(updatedWorkflow).toString('base64'),
      sha,
    }),
  })
  if (!putRes.ok) {
    const txt = await putRes.text()
    return `push-failed (${putRes.status}): ${txt.slice(0, 100)}`
  }
  return 'pushed (build re-triggered via push event)'
}

async function main() {
  const cfToken = process.env.CLOUDFLARE_TOKEN
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (!cfToken || !cfAccountId) {
    console.error('CLOUDFLARE_TOKEN or CLOUDFLARE_ACCOUNT_ID not set in env')
    process.exit(1)
  }

  console.log('Fixing failed repos...\n')

  for (const repo of FAILED_REPOS) {
    console.log(`── ${repo}`)
    const [r1, r2] = await Promise.all([
      setRepoSecret({ owner: OWNER, repo, secretName: 'CLOUDFLARE_API_TOKEN', secretValue: cfToken }),
      setRepoSecret({ owner: OWNER, repo, secretName: 'CLOUDFLARE_ACCOUNT_ID', secretValue: cfAccountId }),
    ])
    console.log(`   secrets: CF_API_TOKEN=${r1 ? '✓' : '✗'}  CF_ACCOUNT_ID=${r2 ? '✓' : '✗'}`)

    const result = await pushUpdatedWorkflow(repo)
    console.log(`   workflow: ${result}`)
  }

  console.log('\nAll done. Check builds at https://github.com/ranjeetsinghai79?tab=repositories')
}

main().catch(e => { console.error(e); process.exit(1) })
