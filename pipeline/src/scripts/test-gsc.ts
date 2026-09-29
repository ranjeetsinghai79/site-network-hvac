/**
 * Smoke test for the Search Console integration.
 * Run: cd pipeline && npx tsx src/scripts/test-gsc.ts
 *
 * Requires two one-time manual steps first (see google-search-console.ts header):
 *   1. Search Console API enabled on the service account's GCP project
 *   2. Service account added as a Full-permission user on the webcrew.app property
 */
import 'dotenv/config'
import { listSites, submitSitemap, listSitemaps, getSearchAnalytics } from '../tools/google-search-console.js'

const SITE_URL = 'sc-domain:webcrew.app'
const SITEMAP_URL = 'https://webcrew.app/sitemap.xml'

async function main() {
  console.log('Testing Google Search Console connection...\n')

  const sites = await listSites()
  console.log(`Sites visible to this service account: ${sites.length}`)
  for (const s of sites) console.log(`  - ${s.siteUrl} (${s.permissionLevel})`)

  if (!sites.some(s => s.siteUrl === SITE_URL)) {
    console.error(`\n❌ ${SITE_URL} not visible — complete step 2 (add service account as a Full user on the property) and re-run.`)
    process.exit(1)
  }

  console.log(`\nSubmitting sitemap: ${SITEMAP_URL}`)
  const submitted = await submitSitemap(SITE_URL, SITEMAP_URL)
  console.log(submitted ? '✅ Sitemap submitted' : '❌ Sitemap submission failed')

  const sitemaps = await listSitemaps(SITE_URL)
  console.log(`\nRegistered sitemaps: ${sitemaps.length}`)
  for (const sm of sitemaps) console.log(`  - ${sm.path} (${sm.isPending ? 'pending' : 'processed'}, ${sm.contents?.[0]?.submitted ?? 0} URLs)`)

  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 28)
  const rows = await getSearchAnalytics({
    siteUrl: SITE_URL,
    startDate: start.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
    dimensions: ['query'],
  })
  console.log(`\nSearch queries in last 28 days: ${rows.length}`)
  if (rows.length === 0) console.log('  (empty is expected on a brand-new property — no organic traffic yet)')
  for (const r of rows.slice(0, 10)) console.log(`  - "${r.keys[0]}" — ${r.clicks} clicks, ${r.impressions} impressions`)
}

main()
