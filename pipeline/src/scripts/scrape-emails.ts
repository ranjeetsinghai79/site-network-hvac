/**
 * scrape-emails.ts
 *
 * Backfills email addresses for leads that have a website but no email.
 * Strategy:
 *   1. Check brand_data.email (already extracted by brand-analyst via Gemini)
 *   2. Firecrawl scrape → extract mailto: links → regex fallback
 *
 * Run:
 *   cd pipeline && npx tsx src/scripts/scrape-emails.ts
 *   cd pipeline && BATCH=200 npx tsx src/scripts/scrape-emails.ts
 */

import pg from 'pg'
import { scrapeSite } from '../tools/firecrawl.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const BATCH    = parseInt(process.env.BATCH || '50', 10)
const DELAY_MS = 600  // avoid Firecrawl rate limits

// Disposable/system email domains to ignore
const IGNORE_DOMAINS = [
  'sentry.io', 'example.com', 'wixpress.com', 'squarespace.com',
  'wordpress.com', 'shopify.com', 'webflow.io', 'godaddy.com',
  'weebly.com', 'jimdo.com', 'site123.com', 'mailchimp.com',
]

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

function extractEmail(markdown: string): string | null {
  // Prefer mailto: links — most intentional
  const mailtoMatch = markdown.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)
  if (mailtoMatch) {
    const email = mailtoMatch[1].trim().toLowerCase()
    if (!IGNORE_DOMAINS.some(d => email.endsWith(`@${d}`) || email.includes(`.${d}`))) {
      return email
    }
  }

  // Regex fallback across full markdown
  const matches = [...new Set((markdown.match(EMAIL_RE) || []).map(e => e.toLowerCase()))]
  for (const email of matches) {
    if (!IGNORE_DOMAINS.some(d => email.endsWith(`@${d}`) || email.includes(`.${d}`))) {
      return email
    }
  }

  return null
}

async function run() {
  console.log(`[EmailScraper] Starting — batch: ${BATCH}`)

  const { rows } = await pool.query<{
    id: string
    name: string
    website: string
    brand_data: any
  }>(`
    SELECT id, name, website, brand_data
    FROM leads
    WHERE website IS NOT NULL
      AND (email IS NULL OR email = '')
      AND website NOT ILIKE '%facebook.%'
      AND website NOT ILIKE '%yelp.%'
      AND website NOT ILIKE '%google.%'
      AND website NOT ILIKE '%instagram.%'
    ORDER BY created_at DESC
    LIMIT $1
  `, [BATCH])

  console.log(`[EmailScraper] ${rows.length} leads to process`)

  let found = 0
  let notFound = 0

  for (const row of rows) {
    try {
      let email: string | null = null

      // 1. brand_data already has email from brand-analyst
      const brandEmail = row.brand_data?.email
      if (brandEmail && typeof brandEmail === 'string' && brandEmail.includes('@')) {
        email = brandEmail.trim().toLowerCase()
      }

      // 2. Firecrawl scrape
      if (!email) {
        const markdown = await scrapeSite(row.website)
        if (markdown) email = extractEmail(markdown)
      }

      if (email) {
        await pool.query(`UPDATE leads SET email = $1 WHERE id = $2`, [email, row.id])
        console.log(`  ✓  ${row.name} → ${email}`)
        found++
      } else {
        console.log(`  —  ${row.name} → no email found`)
        notFound++
      }
    } catch (e: any) {
      console.error(`  ✗  ${row.name}: ${e.message}`)
      notFound++
    }

    await new Promise(r => setTimeout(r, DELAY_MS))
  }

  console.log(`\n[EmailScraper] Done — found: ${found} | not found: ${notFound}`)
  await pool.end()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
