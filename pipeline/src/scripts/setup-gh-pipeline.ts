/**
 * Sets all required secrets on webcrew-platform and creates the scheduled pipeline workflow.
 * Run once: npx tsx pipeline/src/scripts/setup-gh-pipeline.ts
 */
import { config } from 'dotenv'
import { readFileSync } from 'fs'
config({ path: 'pipeline/.env' })
import { setRepoSecret } from '../tools/github.js'

const OWNER = 'ranjeetsinghai79'
const REPO  = 'webcrew-platform'

async function main() {
  const gsaJson = readFileSync('pipeline/service-account.json', 'utf8')

  const secrets: Record<string, string> = {
    GOOGLE_AI_API_KEY:        process.env.GOOGLE_AI_API_KEY!,
    GOOGLE_PLACES_API_KEY:    process.env.GOOGLE_PLACES_API_KEY!,
    FIRECRAWL_URL:            process.env.FIRECRAWL_URL!,
    FIRECRAWL_API_KEY:        process.env.FIRECRAWL_API_KEY!,
    GH_TOKEN:                 process.env.GITHUB_TOKEN!,   // GITHUB_ prefix reserved by GH
    CLOUDFLARE_TOKEN:         process.env.CLOUDFLARE_TOKEN!,
    CLOUDFLARE_ACCOUNT_ID:    process.env.CLOUDFLARE_ACCOUNT_ID!,
    RESEND_API_KEY:           process.env.RESEND_API_KEY!,
    OUTREACH_FROM_EMAIL:      process.env.OUTREACH_FROM_EMAIL!,
    DATABASE_URL:             process.env.DATABASE_URL!,
    LEADS_SHEET_ID:           process.env.LEADS_SHEET_ID!,
    FAL_KEY:                  process.env.FAL_KEY!,
    GOOGLE_SERVICE_ACCOUNT_JSON: gsaJson,
    TEMPLATE_OWNER:           'ranjeetsinghai79',
    TEMPLATE_REPO:            'webcrew-platform',
    DEPLOY_OWNER:             'ranjeetsinghai79',
    CALENDLY_URL:             process.env.CALENDLY_URL || '',
    WEBSITE_PRICE_ONE_TIME:   process.env.WEBSITE_PRICE_ONE_TIME || '29900',
    WEBSITE_PRICE_MONTHLY:    process.env.WEBSITE_PRICE_MONTHLY || '4900',
  }

  console.log(`Setting ${Object.keys(secrets).length} secrets on ${OWNER}/${REPO}...`)
  const results = await Promise.all(
    Object.entries(secrets).map(async ([name, value]) => {
      if (!value) { console.log(`  SKIP ${name} (empty)`); return true }
      const ok = await setRepoSecret({ owner: OWNER, repo: REPO, secretName: name, secretValue: value })
      console.log(`  ${ok ? '✓' : '✗'} ${name}`)
      return ok
    })
  )

  const failed = results.filter(r => !r).length
  if (failed > 0) { console.error(`\n${failed} secrets failed`); process.exit(1) }
  console.log('\nAll secrets set ✓')
}
main()
