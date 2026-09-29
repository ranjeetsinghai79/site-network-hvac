/**
 * backfill-yelp-reviews.ts
 *
 * Matches Yelp_Dataset tab businesses → streams yelp_academic_dataset_review.json
 * → stores top 3 real reviews per business in DB → usable as testimonials in config.ts.
 *
 * Two-pass approach (review file is 5GB, can't load into RAM):
 *   Pass 1: Read Yelp_Dataset sheet tab → collect business_ids (from col R: "yelp:xxx")
 *   Pass 2: Stream review.json → filter for those IDs → keep top 3 (4+ stars, 100+ chars)
 *   Final:  Upsert into yelp_reviews table → available to pipeline via DB join
 *
 * Migration (run once):
 *   psql $DATABASE_URL -c "CREATE TABLE IF NOT EXISTS yelp_reviews (
 *     yelp_business_id TEXT PRIMARY KEY,
 *     reviews JSONB NOT NULL DEFAULT '[]',
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );"
 *
 * Run:
 *   YELP_REVIEW_FILE=/path/to/yelp_academic_dataset_review.json npx tsx --env-file=.env src/scripts/backfill-yelp-reviews.ts
 */
import * as fs from 'fs'
import * as readline from 'readline'
import pg from 'pg'
import { readSheetRows, writeRangeValues } from '../tools/google-sheets.js'

const SHEET_ID     = process.env.LEADS_SHEET_ID!
const REVIEW_FILE  = process.env.YELP_REVIEW_FILE
  ?? '/Users/pavanharati/Documents/WebsiteDeveloper/admin/Yelp/yelp_academic_dataset_review.json'
const DRY_RUN      = process.env.DRY_RUN === 'true'
const MIN_STARS    = 4
const MIN_LEN      = 80    // chars — skip short/useless reviews
const MAX_REVIEWS  = 3     // top N per business
const MAX_TEXT_LEN = 300   // truncate long reviews for storage

const TAB = 'Yelp_Dataset'

interface YelpReview {
  review_id:   string
  business_id: string
  stars:       number
  text:        string
  date:        string
  useful:      number
}

interface StoredReview {
  stars:  number
  text:   string
  date:   string
  useful: number
}

// ─── DB ───────────────────────────────────────────────────────────────────────

let pool: pg.Pool | null = null
function getPool(): pg.Pool {
  if (!pool) pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

async function ensureTable(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS yelp_reviews (
      yelp_business_id TEXT PRIMARY KEY,
      reviews          JSONB NOT NULL DEFAULT '[]',
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

async function upsertReviews(businessId: string, reviews: StoredReview[]): Promise<void> {
  await getPool().query(
    `INSERT INTO yelp_reviews (yelp_business_id, reviews, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (yelp_business_id) DO UPDATE
       SET reviews = $2, updated_at = NOW()`,
    [businessId, JSON.stringify(reviews)]
  )
}

// ─── Pass 1: collect business IDs from sheet ─────────────────────────────────

async function collectYelpIds(): Promise<Map<string, number>> {
  console.log(`  Reading ${TAB} tab...`)
  const rows = await readSheetRows({ spreadsheetId: SHEET_ID, sheetName: TAB, range: 'A:V' })
  const idToRow = new Map<string, number>()
  for (let i = 1; i < rows.length; i++) {
    const sourceUrl = rows[i][17] ?? ''  // col R
    const match = sourceUrl.match(/^yelp:(.+)$/)
    if (match) idToRow.set(match[1], i + 1)
  }
  console.log(`  Found ${idToRow.size} Yelp businesses in sheet`)
  return idToRow
}

// ─── Pass 2: stream review.json ──────────────────────────────────────────────

async function streamReviews(
  targetIds: Set<string>,
  onBatch: (businessId: string, reviews: StoredReview[]) => Promise<void>
): Promise<{ scanned: number; matched: number; stored: number }> {

  // Buffer: business_id → candidate reviews (sorted by useful desc)
  const buffer = new Map<string, StoredReview[]>()

  const rl = readline.createInterface({
    input: fs.createReadStream(REVIEW_FILE, { highWaterMark: 1024 * 1024 }),
    crlfDelay: Infinity,
  })

  let scanned = 0

  for await (const line of rl) {
    if (!line.trim()) continue
    scanned++

    let rev: YelpReview
    try { rev = JSON.parse(line) } catch { continue }

    if (!targetIds.has(rev.business_id)) continue
    if (rev.stars < MIN_STARS) continue
    if (!rev.text || rev.text.length < MIN_LEN) continue

    const entry: StoredReview = {
      stars:  rev.stars,
      text:   rev.text.trim().slice(0, MAX_TEXT_LEN),
      date:   rev.date.split(' ')[0],
      useful: rev.useful ?? 0,
    }

    const bucket = buffer.get(rev.business_id) ?? []
    bucket.push(entry)
    // Sort by useful+stars descending, keep top N*2 candidates
    if (bucket.length > MAX_REVIEWS * 2) {
      bucket.sort((a, b) => (b.useful + b.stars) - (a.useful + a.stars))
      bucket.length = MAX_REVIEWS * 2
    }
    buffer.set(rev.business_id, bucket)

    if (scanned % 500_000 === 0) {
      process.stdout.write(`  Scanned: ${(scanned / 1_000_000).toFixed(1)}M reviews | Buffer: ${buffer.size} businesses\r`)
    }
  }

  console.log(`\n  Scan complete: ${scanned.toLocaleString()} reviews | ${buffer.size} businesses with matches`)

  // Flush buffer → DB
  let stored = 0
  for (const [bizId, revs] of buffer) {
    const top = revs
      .sort((a, b) => (b.useful + b.stars * 2) - (a.useful + a.stars * 2))
      .slice(0, MAX_REVIEWS)
    if (!DRY_RUN) await onBatch(bizId, top)
    stored++
  }

  return { scanned, matched: buffer.size, stored }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }
  if (!fs.existsSync(REVIEW_FILE)) {
    console.error(`Review file not found: ${REVIEW_FILE}`)
    console.error('Set YELP_REVIEW_FILE env to correct path')
    process.exit(1)
  }

  const fileSize = (fs.statSync(REVIEW_FILE).size / 1024 / 1024 / 1024).toFixed(1)
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📝  Yelp Review Backfill`)
  console.log(`    Review file: ${REVIEW_FILE} (${fileSize}GB)`)
  console.log(`    Min stars: ${MIN_STARS} | Min length: ${MIN_LEN} chars | Max/biz: ${MAX_REVIEWS}`)
  console.log(`    DRY_RUN: ${DRY_RUN}`)
  console.log(`${'═'.repeat(60)}\n`)

  // Pass 1
  const idToRow = await collectYelpIds()
  if (!idToRow.size) {
    console.log('No Yelp businesses found in sheet. Run import-yelp-dataset.ts first.')
    process.exit(0)
  }

  if (!DRY_RUN) await ensureTable()

  const targetIds = new Set(idToRow.keys())

  // Pass 2
  console.log(`\n  Streaming ${fileSize}GB review file (this takes 3-5 min)...`)
  const { scanned, matched, stored } = await streamReviews(targetIds, upsertReviews)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Done`)
  console.log(`   Reviews scanned: ${scanned.toLocaleString()}`)
  console.log(`   Businesses matched: ${matched.toLocaleString()} / ${targetIds.size.toLocaleString()}`)
  console.log(`   Reviews stored: ${stored.toLocaleString()} businesses in DB`)
  console.log(`\n   Query testimonials:`)
  console.log(`   SELECT yelp_business_id, reviews FROM yelp_reviews LIMIT 5;`)
  console.log(`${'═'.repeat(60)}\n`)

  if (pool) await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
