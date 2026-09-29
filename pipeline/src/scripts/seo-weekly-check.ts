/**
 * seo-weekly-check.ts — weekly webcrew.app SEO/AEO/GEO monitor, real data only.
 *
 * Started 2026-09-27 after a manual Search Console pull showed indexing is
 * healthy but rankings/impressions for the actual money keywords
 * ("[trade] ai receptionist") are very low (position 40-90) with near-zero
 * citation footprint (no sameAs / external profiles anywhere). Root cause is
 * domain authority, not on-page technical SEO — see CLAUDE.md's OpenSEO
 * section for the full writeup.
 *
 * This script MONITORS and REPORTS — it does not edit or deploy the live
 * site unattended. Recommended fixes are read-only findings in the email;
 * an actual code/content change always happens in a real session where a
 * human is present, same as any other change to a public site. That's a
 * deliberate choice, not a limitation to work around.
 *
 * Weekly, not daily: GSC data itself lags ~2-3 days and rankings don't move
 * meaningfully day to day — a daily run would mostly re-report noise.
 *
 * Runs LOCALLY (not a cloud routine) because it needs the local-only
 * GOOGLE_SERVICE_ACCOUNT_FILE service-account key already used by
 * google-search-console.ts — the same key health-check.ts's checkGscHealth()
 * already reads. A cloud sandbox has no access to that file or to the local
 * OpenSEO Docker instance, so this intentionally stays a local launchd job,
 * same pattern as health-check.ts.
 *
 * Usage: cd pipeline && npx tsx src/scripts/seo-weekly-check.ts
 * Scheduled: com.webcrew.seo-weekly-check launchd job, weekly (see plist).
 */

import 'dotenv/config'
import pg from 'pg'
import { listSites, listSitemaps, getSearchAnalytics, inspectUrl } from '../tools/google-search-console.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const SITE_URL = 'sc-domain:webcrew.app'
const TRACKED_PAGES = [
  'https://webcrew.app/',
  'https://webcrew.app/hvac',
  'https://webcrew.app/roofing',
  'https://webcrew.app/plumbing',
  'https://webcrew.app/electricians',
  'https://webcrew.app/contractors',
  'https://webcrew.app/cleaning',
  'https://webcrew.app/salons',
  'https://webcrew.app/spas',
  'https://webcrew.app/ai-receptionist',
  'https://webcrew.app/google-business-profile-management',
]

type QueryRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

async function fetchSnapshot() {
  const end = new Date()
  const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000) // trailing 28 days — GSC's own standard window
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const [sites, sitemaps, queries, pages] = await Promise.all([
    listSites(),
    listSitemaps(SITE_URL),
    getSearchAnalytics({ siteUrl: SITE_URL, startDate: fmt(start), endDate: fmt(end), dimensions: ['query'], rowLimit: 200 }) as Promise<QueryRow[]>,
    getSearchAnalytics({ siteUrl: SITE_URL, startDate: fmt(start), endDate: fmt(end), dimensions: ['page'], rowLimit: 100 }) as Promise<QueryRow[]>,
  ])

  const inspections: Record<string, any> = {}
  for (const url of TRACKED_PAGES) {
    const r = await inspectUrl(SITE_URL, url)
    const result = r?.inspectionResult?.indexStatusResult
    inspections[url] = {
      verdict: result?.verdict ?? 'UNKNOWN',
      coverageState: result?.coverageState ?? 'unknown',
      pageFetchState: result?.pageFetchState ?? 'unknown',
      lastCrawlTime: result?.lastCrawlTime ?? null,
    }
  }

  return { fetchedAt: new Date().toISOString(), windowStart: fmt(start), windowEnd: fmt(end), sites, sitemaps, queries, pages, inspections }
}

function keyOf(row: QueryRow) { return row.keys.join('|') }

function computeDeltas(current: QueryRow[], previous: QueryRow[] | null) {
  if (!previous) return { improving: [], declining: [], new: current.map(keyOf), dropped: [] }

  const prevMap = new Map(previous.map(r => [keyOf(r), r]))
  const currMap = new Map(current.map(r => [keyOf(r), r]))

  const improving: any[] = []
  const declining: any[] = []
  const newKeys: string[] = []
  const dropped: string[] = []

  for (const [key, curr] of currMap) {
    const prev = prevMap.get(key)
    if (!prev) { newKeys.push(key); continue }
    const posDelta = prev.position - curr.position // positive = moved up (better)
    const impDelta = curr.impressions - prev.impressions
    if (posDelta >= 3 || impDelta >= 5) improving.push({ key, posDelta: round1(posDelta), impDelta, position: round1(curr.position), impressions: curr.impressions })
    else if (posDelta <= -3 || impDelta <= -5) declining.push({ key, posDelta: round1(posDelta), impDelta, position: round1(curr.position), impressions: curr.impressions })
  }
  for (const key of prevMap.keys()) if (!currMap.has(key)) dropped.push(key)

  return { improving, declining, new: newKeys, dropped }
}

function round1(n: number) { return Math.round(n * 10) / 10 }

function buildFindings(snapshot: any, deltas: any) {
  const findings: { area: string; summary: string; recommendation: string }[] = []

  const zeroClickHighImpression = snapshot.queries.filter((q: QueryRow) => q.clicks === 0 && q.impressions >= 5)
  if (zeroClickHighImpression.length > 0) {
    findings.push({
      area: 'CTR',
      summary: `${zeroClickHighImpression.length} query/queries getting impressions but zero clicks: ${zeroClickHighImpression.map((q: QueryRow) => q.keys[0]).join(', ')}`,
      recommendation: 'Check title/meta description relevance for these exact queries — impressions with 0 clicks usually means the snippet doesn\'t match what the searcher typed.',
    })
  }

  const badIndexing = Object.entries(snapshot.inspections).filter(([, v]: any) => v.verdict !== 'PASS' && v.verdict !== 'NEUTRAL')
  if (badIndexing.length > 0) {
    findings.push({
      area: 'Indexing',
      summary: `${badIndexing.length} tracked page(s) not passing URL Inspection: ${badIndexing.map(([url]) => url).join(', ')}`,
      recommendation: 'Investigate immediately — a page that stops indexing loses all its rankings, this is higher priority than any ranking change.',
    })
  }

  if (deltas.declining.length > 0) {
    findings.push({
      area: 'Rankings — declining',
      summary: `${deltas.declining.length} query/queries lost position or impressions vs last week: ${deltas.declining.map((d: any) => d.key).join(', ')}`,
      recommendation: 'Check if a recent content/template change touched the relevant page, or if a competitor page overtook it (would need a manual SERP check — not automated here).',
    })
  }

  if (deltas.improving.length > 0) {
    findings.push({
      area: 'Rankings — improving',
      summary: `${deltas.improving.length} query/queries gained position or impressions vs last week: ${deltas.improving.map((d: any) => d.key).join(', ')}`,
      recommendation: 'Keep whatever is working — do not touch the page/content behind these queries without reason.',
    })
  }

  const totalImpressions = snapshot.queries.reduce((s: number, q: QueryRow) => s + q.impressions, 0)
  if (totalImpressions < 200) {
    findings.push({
      area: 'Authority / citations',
      summary: `Total impressions across all queries this window: ${totalImpressions} — still very low for a site with healthy indexing and decent on-page content.`,
      recommendation: 'This is very unlikely to be an on-page fix. The Organization schema has zero sameAs links and there is no LinkedIn/Crunchbase/Product Hunt presence anywhere — external citations/backlinks are the real lever here, not more content tweaks.',
    })
  }

  return findings
}

async function sendReport(snapshot: any, deltas: any, findings: any[]) {
  await pool.query(
    `INSERT INTO seo_weekly_checks (snapshot, deltas, findings) VALUES ($1::jsonb, $2::jsonb, $3::jsonb)`,
    [JSON.stringify(snapshot), JSON.stringify(deltas), JSON.stringify(findings)]
  )

  const findingRows = findings.map(f => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee"><b>${f.area}</b></td>
      <td style="padding:8px;border-bottom:1px solid #eee">${f.summary}<br><span style="color:#666;font-size:0.85rem">→ ${f.recommendation}</span></td>
    </tr>`).join('')

  const topQueries = [...snapshot.queries]
    .sort((a: QueryRow, b: QueryRow) => b.impressions - a.impressions)
    .slice(0, 15)
    .map((q: QueryRow) => `<tr><td style="padding:6px">${q.keys[0]}</td><td style="padding:6px">${round1(q.position)}</td><td style="padding:6px">${q.impressions}</td><td style="padding:6px">${q.clicks}</td></tr>`)
    .join('')

  const subject = `webcrew.app SEO weekly — ${findings.length} finding(s), ${snapshot.queries.length} queries tracked`

  const html = `<div style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px">
    <h2>webcrew.app weekly SEO/AEO/GEO check</h2>
    <p style="color:#666">Window: ${snapshot.windowStart} to ${snapshot.windowEnd}. This is a monitoring report only — no site changes were made automatically.</p>
    <h3>Findings</h3>
    <table style="width:100%;border-collapse:collapse">${findingRows || '<tr><td style="padding:8px">No notable findings this week.</td></tr>'}</table>
    <h3>Top queries by impressions</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr style="font-weight:bold;border-bottom:2px solid #333"><td style="padding:6px">Query</td><td style="padding:6px">Avg position</td><td style="padding:6px">Impressions</td><td style="padding:6px">Clicks</td></tr>
      ${topQueries}
    </table>
    <p style="color:#999;font-size:0.8rem">Run at ${snapshot.fetchedAt}. History: <code>SELECT * FROM seo_weekly_checks ORDER BY run_at DESC LIMIT 10</code></p>
  </div>`

  if (process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.app',
        to: process.env.BUSINESS_OWNER_EMAIL || 'pavan.harati@gmail.com',
        subject, html,
      }),
    }).catch(e => console.error('[SeoWeekly] Email send failed:', e.message))
  } else {
    console.warn('[SeoWeekly] RESEND_API_KEY not set — report logged only, not emailed')
  }

  console.log(`\n${findings.length} finding(s) this week. ${snapshot.queries.length} queries, ${snapshot.pages.length} pages tracked.`)
}

async function main() {
  const snapshot = await fetchSnapshot()

  const { rows } = await pool.query(
    `SELECT snapshot FROM seo_weekly_checks ORDER BY run_at DESC LIMIT 1`
  )
  const previousQueries: QueryRow[] | null = rows[0]?.snapshot?.queries ?? null

  const deltas = computeDeltas(snapshot.queries, previousQueries)
  const findings = buildFindings(snapshot, deltas)

  await sendReport(snapshot, deltas, findings)
  await pool.end()
}

main().catch(async (e) => {
  console.error('[SeoWeekly] FATAL', e)
  await pool.end()
  process.exit(1)
})
