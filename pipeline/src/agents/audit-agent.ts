/**
 * audit-agent.ts
 *
 * Generates a free AI Growth Audit for a beauty/wellness business.
 * Used as the lead magnet: "paste URL → get audit in 2 minutes"
 *
 * Scores:
 *   website_score   — PageSpeed mobile (0-100)
 *   seo_score       — meta, schema, H1, local keywords (0-100)
 *   reputation_score — rating, review count, on-site reviews (0-100)
 *   phone_score     — click-to-call present (0 or 100)
 *   booking_score   — online booking link present (0 or 100)
 *   overall_score   — weighted composite
 *
 * Output stored in `audits` table. Report URL: /audit/{id}
 */

import { geminiText, GEMINI_PRO } from '../tools/gemini.js'
import { scoreSite } from '../tools/pagespeed.js'
import { scrapeSite } from '../tools/firecrawl.js'
import type { AuditReport, AuditRecommendation, AuditCompetitor } from '../types.js'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })


// ─── SEO extraction ───────────────────────────────────────────────────────────

const SEO_EXTRACTION_PROMPT = `Analyze this website content and extract SEO/conversion signals. Return valid JSON only, no markdown.

{
  "meta_title": "page title if found in content",
  "meta_description": "meta description if found",
  "has_schema": true/false (schema.org markup present),
  "h1_content": "main H1 heading if found",
  "phone_found": true/false (phone number visible on page),
  "has_booking_link": true/false (online booking/appointment link present),
  "booking_url": "booking URL if found, else null",
  "has_reviews_on_site": true/false (customer reviews/testimonials on page),
  "local_keywords": ["city", "neighborhood keywords found in content"],
  "seo_issues": ["list of specific SEO problems found, max 5"]
}

Rules:
- phone_found: true if any phone number format visible (e.g. (555) 555-5555 or 555-555-5555)
- has_booking_link: true if "book", "schedule", "appointment", "reserve" links visible
- seo_issues: specific problems like "No meta description", "H1 missing", "No local city keyword in title", "No schema markup", "No booking CTA"
- Return null for meta_title/meta_description if not found in content`

async function extractSEOSignals(content: string): Promise<{
  meta_title: string | null
  meta_description: string | null
  has_schema: boolean
  h1_content: string | null
  phone_found: boolean
  has_booking_link: boolean
  booking_url: string | null
  has_reviews_on_site: boolean
  local_keywords: string[]
  seo_issues: string[]
}> {
  try {
    const text = await geminiText(
      `${SEO_EXTRACTION_PROMPT}\n\nWebsite content:\n${content.slice(0, 6000)}`,
      { model: GEMINI_PRO }
    )
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON')
    return JSON.parse(jsonMatch[0])
  } catch {
    return {
      meta_title: null,
      meta_description: null,
      has_schema: false,
      h1_content: null,
      phone_found: false,
      has_booking_link: false,
      booking_url: null,
      has_reviews_on_site: false,
      local_keywords: [],
      seo_issues: ['Could not analyze page content'],
    }
  }
}

// ─── Recommendation generation ────────────────────────────────────────────────

const RECS_PROMPT = `You are an AI agency advisor for beauty and wellness businesses (medspas, dental offices, skin clinics, salons, etc.).

Based on this business audit data, generate 4-5 specific, actionable recommendations.
Return valid JSON array only, no markdown.

[
  {
    "title": "Short action title",
    "description": "1-2 sentence specific description of the problem and fix",
    "priority": "high|medium|low",
    "impact": "Estimated impact, e.g. '5-10 more bookings/month' or 'Appear in top 3 Google results'"
  }
]

Prioritize: missing online booking, no phone CTA, slow mobile site, missing reviews, no schema markup.
Be specific to beauty/wellness. Mention the actual score where relevant.
High priority = direct revenue impact. Medium = trust/SEO. Low = nice-to-have.`

async function generateRecommendations(
  auditData: Partial<AuditReport>
): Promise<AuditRecommendation[]> {
  const summary = JSON.stringify({
    overall_score: auditData.overall_score,
    website_score: auditData.website_score,
    seo_score: auditData.seo_score,
    reputation_score: auditData.reputation_score,
    phone_found: auditData.phone_found,
    has_booking_link: auditData.has_booking_link,
    has_schema: auditData.has_schema,
    site_issues: auditData.site_issues,
    seo_issues: auditData.seo_issues,
    meta_title: auditData.meta_title,
    meta_description: auditData.meta_description,
    has_reviews_on_site: auditData.has_reviews_on_site,
    niche: auditData.niche,
    city: auditData.city,
  })

  try {
    const text = await geminiText(`${RECS_PROMPT}\n\nAudit data:\n${summary}`, { model: GEMINI_PRO })
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array')
    return JSON.parse(jsonMatch[0])
  } catch {
    return [
      {
        title: 'Add Online Booking',
        description: 'No booking link detected. Beauty/wellness clients expect to book online 24/7.',
        priority: 'high',
        impact: '10-20 more bookings/month',
      },
    ]
  }
}

// ─── Scoring logic ────────────────────────────────────────────────────────────

function calcSEOScore(signals: Awaited<ReturnType<typeof extractSEOSignals>>): number {
  let score = 0
  if (signals.meta_title)        score += 25
  if (signals.meta_description)  score += 20
  if (signals.has_schema)        score += 25
  if (signals.h1_content)        score += 15
  if (signals.local_keywords.length > 0) score += 15
  return Math.min(score, 100)
}

function calcReputationScore(rating?: number, reviewCount?: number, hasReviewsOnSite?: boolean): number {
  let score = 0
  if (rating) {
    if (rating >= 4.8) score += 40
    else if (rating >= 4.5) score += 30
    else if (rating >= 4.0) score += 20
    else score += 10
  }
  if (reviewCount) {
    if (reviewCount >= 100) score += 35
    else if (reviewCount >= 50) score += 25
    else if (reviewCount >= 20) score += 15
    else score += 5
  }
  if (hasReviewsOnSite) score += 25
  return Math.min(score, 100)
}

function calcOverallScore(
  websiteScore: number,
  seoScore: number,
  reputationScore: number,
  phoneScore: number,
  bookingScore: number
): number {
  return Math.round(
    websiteScore    * 0.25 +
    seoScore        * 0.25 +
    reputationScore * 0.25 +
    phoneScore      * 0.15 +
    bookingScore    * 0.10
  )
}

// ─── Competitors via Places API ───────────────────────────────────────────────

async function fetchCompetitors(niche: string, city: string): Promise<AuditCompetitor[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey || !niche || !city) return []

  // Map niche to Places API text query
  const nicheQuery: Record<string, string> = {
    medspa: 'med spa', 'skin-clinic': 'skin clinic aesthetics', dentist: 'dental office',
    salon: 'hair salon', barbershop: 'barbershop', 'iv-therapy': 'IV therapy clinic',
    'nail-studio': 'nail salon', orthodontist: 'orthodontist', 'weight-loss-clinic': 'weight loss clinic',
  }
  const query = `${nicheQuery[niche] ?? niche} in ${city}`

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    )
    const data = await res.json() as any
    if (!data.results) return []

    return data.results.slice(0, 3).map((p: any) => ({
      name: p.name,
      rating: p.rating ?? 0,
      review_count: p.user_ratings_total ?? 0,
      website: p.website,
    }))
  } catch {
    return []
  }
}

// ─── Save audit to DB ─────────────────────────────────────────────────────────

export async function saveAudit(report: AuditReport): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO audits (
      lead_id, website_url, business_name, niche, city,
      overall_score, website_score, seo_score, reputation_score, phone_score, booking_score,
      mobile_score, desktop_score, site_issues, site_broken,
      meta_title, meta_description, has_schema, h1_content, seo_issues,
      phone_found, has_booking_link, booking_url, has_reviews_on_site,
      competitors, recommendations
    ) VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,$11,
      $12,$13,$14,$15,
      $16,$17,$18,$19,$20,
      $21,$22,$23,$24,
      $25,$26
    ) RETURNING id`,
    [
      report.lead_id ?? null,
      report.website_url,
      report.business_name,
      report.niche ?? null,
      report.city ?? null,
      report.overall_score,
      report.website_score,
      report.seo_score,
      report.reputation_score,
      report.phone_score,
      report.booking_score,
      report.mobile_score,
      report.desktop_score,
      JSON.stringify(report.site_issues),
      report.site_broken,
      report.meta_title,
      report.meta_description,
      report.has_schema,
      report.h1_content,
      JSON.stringify(report.seo_issues),
      report.phone_found,
      report.has_booking_link,
      report.booking_url ?? null,
      report.has_reviews_on_site,
      JSON.stringify(report.competitors),
      JSON.stringify(report.recommendations),
    ]
  )
  return rows[0].id as string
}

// ─── Main audit function ──────────────────────────────────────────────────────

export interface RunAuditOptions {
  url: string
  businessName?: string
  niche?: string
  city?: string
  leadId?: string
  rating?: number
  reviewCount?: number
}

export async function runAuditAgent(opts: RunAuditOptions): Promise<{ success: boolean; report?: AuditReport; auditId?: string; error?: string }> {
  const { url, niche, city, leadId, rating, reviewCount } = opts
  const businessName = opts.businessName ?? new URL(url).hostname.replace('www.', '')

  console.log(`[Audit] Starting audit for ${businessName} (${url})`)

  try {
    // Run PageSpeed + Firecrawl in parallel
    const [pageSpeed, rawContent] = await Promise.all([
      scoreSite(url).catch(() => ({ url, mobile_score: 0, desktop_score: 0, issues: ['PageSpeed unavailable'], scored: false, broken: false })),
      scrapeSite(url).catch(() => null),
    ])

    console.log(`[Audit] PageSpeed: ${pageSpeed.mobile_score}/100 mobile`)

    // Extract SEO signals from scraped content
    const seoSignals = rawContent
      ? await extractSEOSignals(rawContent)
      : {
          meta_title: null, meta_description: null, has_schema: false,
          h1_content: null, phone_found: false, has_booking_link: false,
          booking_url: null, has_reviews_on_site: false, local_keywords: [],
          seo_issues: ['Could not scrape website'],
        }

    console.log(`[Audit] SEO signals extracted — phone: ${seoSignals.phone_found}, booking: ${seoSignals.has_booking_link}`)

    // Fetch competitors in parallel with score calculation
    const competitorsPromise = (niche && city)
      ? fetchCompetitors(niche, city)
      : Promise.resolve([])

    // Calculate scores
    const websiteScore   = pageSpeed.broken ? 0 : pageSpeed.mobile_score
    const seoScore       = calcSEOScore(seoSignals)
    const reputationScore = calcReputationScore(rating, reviewCount, seoSignals.has_reviews_on_site)
    const phoneScore     = seoSignals.phone_found ? 100 : 0
    const bookingScore   = seoSignals.has_booking_link ? 100 : 0
    const overallScore   = calcOverallScore(websiteScore, seoScore, reputationScore, phoneScore, bookingScore)

    const partialReport: Partial<AuditReport> = {
      website_url:        url,
      business_name:      businessName,
      niche,
      city,
      overall_score:      overallScore,
      website_score:      websiteScore,
      seo_score:          seoScore,
      reputation_score:   reputationScore,
      phone_score:        phoneScore,
      booking_score:      bookingScore,
      mobile_score:       pageSpeed.mobile_score,
      desktop_score:      pageSpeed.desktop_score,
      site_issues:        pageSpeed.issues,
      site_broken:        pageSpeed.broken ?? false,
      meta_title:         seoSignals.meta_title,
      meta_description:   seoSignals.meta_description,
      has_schema:         seoSignals.has_schema,
      h1_content:         seoSignals.h1_content,
      seo_issues:         seoSignals.seo_issues,
      phone_found:        seoSignals.phone_found,
      has_booking_link:   seoSignals.has_booking_link,
      booking_url:        seoSignals.booking_url,
      has_reviews_on_site: seoSignals.has_reviews_on_site,
    }

    // Run recommendations + competitors in parallel
    const [recommendations, competitors] = await Promise.all([
      generateRecommendations(partialReport),
      competitorsPromise,
    ])

    const report: AuditReport = {
      ...partialReport as AuditReport,
      lead_id:         leadId,
      created_at:      new Date().toISOString(),
      competitors,
      recommendations,
    }

    console.log(`[Audit] Overall score: ${overallScore}/100 | ${recommendations.length} recommendations`)

    const auditId = await saveAudit(report)
    console.log(`[Audit] Saved → audit ID: ${auditId}`)

    return { success: true, report: { ...report, id: auditId }, auditId }
  } catch (e: any) {
    console.error(`[Audit] Failed: ${e.message}`)
    return { success: false, error: e.message }
  }
}

// ─── Get audit by ID (for report page) ───────────────────────────────────────

export async function getAuditById(id: string): Promise<AuditReport | null> {
  try {
    const { rows } = await pool.query('SELECT * FROM audits WHERE id = $1', [id])
    if (!rows[0]) return null
    const r = rows[0]
    return {
      id:                r.id,
      lead_id:           r.lead_id,
      website_url:       r.website_url,
      business_name:     r.business_name,
      niche:             r.niche,
      city:              r.city,
      created_at:        r.created_at,
      overall_score:     r.overall_score,
      website_score:     r.website_score,
      seo_score:         r.seo_score,
      reputation_score:  r.reputation_score,
      phone_score:       r.phone_score,
      booking_score:     r.booking_score,
      mobile_score:      r.mobile_score,
      desktop_score:     r.desktop_score,
      site_issues:       r.site_issues ?? [],
      site_broken:       r.site_broken ?? false,
      meta_title:        r.meta_title,
      meta_description:  r.meta_description,
      has_schema:        r.has_schema,
      h1_content:        r.h1_content,
      seo_issues:        r.seo_issues ?? [],
      phone_found:       r.phone_found,
      has_booking_link:  r.has_booking_link,
      booking_url:       r.booking_url,
      has_reviews_on_site: r.has_reviews_on_site,
      competitors:       r.competitors ?? [],
      recommendations:   r.recommendations ?? [],
      report_viewed:     r.report_viewed,
      report_viewed_at:  r.report_viewed_at,
      outreach_sent:     r.outreach_sent,
    }
  } catch {
    return null
  }
}

// ─── Mark report as viewed ────────────────────────────────────────────────────

export async function markAuditViewed(id: string): Promise<void> {
  await pool.query(
    'UPDATE audits SET report_viewed=TRUE, report_viewed_at=NOW() WHERE id=$1 AND NOT report_viewed',
    [id]
  )
}
