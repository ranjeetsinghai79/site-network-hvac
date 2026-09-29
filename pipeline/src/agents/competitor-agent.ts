/**
 * competitor-agent.ts — Grow+ tier monthly competitor tracking report
 *
 * For each client:
 *   1. Google Places API → find top 3 same-niche competitors in same city
 *   2. PageSpeed API → score each competitor's site
 *   3. Gemini → write comparison analysis + recommendations
 *   4. Resend → email report to client
 *
 * Triggered by scheduler.ts monthly (Grow + Scale only).
 */

import { geminiText, GEMINI_FLASH } from '../tools/gemini.js'
import type { Lead, AgentResult }   from '../types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Competitor {
  name: string
  website?: string
  rating?: number
  reviewCount?: number
  address?: string
  mobileScore?: number
}

// ─── Find competitors via Google Places ───────────────────────────────────────

async function findCompetitors(lead: Lead): Promise<Competitor[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set')

  const query = `${lead.niche} in ${lead.city} ${lead.state}`
  const url = `https://places.googleapis.com/v1/places:searchText`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.websiteUri,places.rating,places.userRatingCount,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 6, languageCode: 'en' }),
  })

  if (!res.ok) throw new Error(`Places API error: ${res.status}`)
  const data: any = await res.json()

  const places: Competitor[] = (data.places ?? [])
    .filter((p: any) => {
      // Exclude the client's own business by name similarity
      const pName = (p.displayName?.text ?? '').toLowerCase()
      const lName = (lead.name ?? '').toLowerCase()
      return pName !== lName && !pName.includes(lName.split(' ')[0])
    })
    .slice(0, 3)
    .map((p: any) => ({
      name:        p.displayName?.text ?? 'Unknown',
      website:     p.websiteUri,
      rating:      p.rating,
      reviewCount: p.userRatingCount,
      address:     p.formattedAddress,
    }))

  return places
}

// ─── Score competitor site with PageSpeed ─────────────────────────────────────

async function scoreCompetitorSite(website: string): Promise<number | undefined> {
  if (!website) return undefined
  try {
    const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(website)}&strategy=mobile&key=${process.env.GOOGLE_PLACES_API_KEY}`
    const res  = await fetch(url)
    if (!res.ok) return undefined
    const data: any = await res.json()
    return Math.round((data.lighthouseResult?.categories?.performance?.score ?? 0) * 100)
  } catch {
    return undefined
  }
}

// ─── Get client's own score from lead data ────────────────────────────────────

function clientScore(lead: Lead): number {
  const siteUrl = lead.cloudflare_url ?? lead.vercel_url
  return lead.site_score ?? (siteUrl ? 95 : 0)
}

// ─── Gemini: generate human-readable report ───────────────────────────────────

async function generateReport(lead: Lead, competitors: Competitor[]): Promise<string> {
  const myScore = clientScore(lead)

  const competitorSummary = competitors
    .map((c, i) =>
      `Competitor ${i + 1}: ${c.name}
  - Website: ${c.website ?? 'None'}
  - Mobile PageSpeed score: ${c.mobileScore ?? 'N/A'}
  - Google rating: ${c.rating ?? 'N/A'} (${c.reviewCount ?? 0} reviews)`
    )
    .join('\n\n')

  return geminiText(`
You are a digital marketing analyst. Write a friendly, actionable monthly competitor report email body for a local business client.

CLIENT: ${lead.name} (${lead.niche} in ${lead.city}, ${lead.state})
CLIENT'S SITE SCORE: ${myScore}/100 mobile PageSpeed
CLIENT'S SITE: ${lead.cloudflare_url ?? lead.vercel_url}

COMPETITORS THIS MONTH:
${competitorSummary}

Write an email body (no subject line, no HTML, plain paragraphs) that:
1. Opens with a 1-sentence summary of their competitive position
2. Lists the 3 competitors with their scores — highlight where client wins
3. Points out 1-2 specific opportunities (e.g., competitor has no website, lower score, fewer reviews)
4. Closes with 1 recommended action for next month
5. Keep it under 300 words. Friendly, professional tone. Not salesy.
`, { model: GEMINI_FLASH, maxTokens: 1000 })
}

// ─── Send report via Resend ───────────────────────────────────────────────────

async function sendReport(lead: Lead, competitors: Competitor[], reportBody: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey || !lead.email) return

  const fromEmail  = process.env.OUTREACH_FROM_EMAIL ?? 'hello@webcrew.app'
  const adminEmail = process.env.BUSINESS_OWNER_EMAIL ?? fromEmail

  const to = [lead.email, adminEmail].filter(Boolean)

  const competitorRows = competitors
    .map(c => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">${c.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">${c.website ? `<a href="${c.website}">${new URL(c.website).hostname}</a>` : '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${c.mobileScore ?? '—'}/100</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${c.rating ?? '—'} ★ (${c.reviewCount ?? 0})</td>
      </tr>`)
    .join('')

  const myScore = clientScore(lead)

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    fromEmail,
      to,
      subject: `Monthly Competitor Report — ${lead.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
          <h2 style="margin:0 0 4px;font-size:22px">Monthly Competitor Report</h2>
          <p style="color:#666;margin:0 0 24px;font-size:14px">${lead.name} · ${lead.city}, ${lead.state} · ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>

          <div style="background:#f8f9fa;border-radius:10px;padding:16px 20px;margin-bottom:24px">
            <div style="font-size:13px;color:#666;margin-bottom:4px">Your Mobile Speed Score</div>
            <div style="font-size:32px;font-weight:800;color:${myScore >= 70 ? '#16a34a' : myScore >= 50 ? '#d97706' : '#dc2626'}">${myScore}/100</div>
          </div>

          <h3 style="font-size:15px;margin:0 0 12px">Local Competitors This Month</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
            <thead>
              <tr style="background:#f8f9fa">
                <th style="padding:10px 12px;text-align:left">Business</th>
                <th style="padding:10px 12px;text-align:left">Website</th>
                <th style="padding:10px 12px;text-align:center">Speed</th>
                <th style="padding:10px 12px;text-align:center">Reviews</th>
              </tr>
            </thead>
            <tbody>${competitorRows}</tbody>
          </table>

          <div style="white-space:pre-line;font-size:14px;line-height:1.7;color:#374151">${reportBody}</div>

          <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0">
          <p style="font-size:12px;color:#9ca3af">WebCrew · Grow Plan · Monthly Competitor Tracking</p>
        </div>`,
    }),
  })
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runCompetitorAgent(
  lead: Lead
): Promise<AgentResult<{ competitors: number; emailSent: boolean }>> {
  console.log(`[Competitor] Tracking competitors for ${lead.name}`)

  try {
    // 1. Find competitors
    const competitors = await findCompetitors(lead)
    if (!competitors.length) {
      return { success: false, error: 'No competitors found via Places API' }
    }

    // 2. Score their sites (parallel, don't fail if one times out)
    const scored = await Promise.all(
      competitors.map(async (c) => ({
        ...c,
        mobileScore: c.website ? await scoreCompetitorSite(c.website) : undefined,
      }))
    )

    // 3. Generate report
    const reportBody = await generateReport(lead, scored)

    // 4. Email report
    const emailSent = !!(lead.email && process.env.RESEND_API_KEY)
    if (emailSent) await sendReport(lead, scored, reportBody)

    return { success: true, data: { competitors: scored.length, emailSent } }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
