import { geminiText, GEMINI_FLASH } from '../tools/gemini.js'
import pg                           from 'pg'
import type { Lead, AgentResult }   from '../types.js'
const pool  = new pg.Pool({ connectionString: process.env.DATABASE_URL })

interface CallStats { callsAnswered: number; appointmentsBooked: number; avgDurationSec: number }

async function getCallStats(leadId: string): Promise<CallStats> {
  try {
    const { rows } = await pool.query(
      `SELECT duration_seconds, transcript FROM call_logs
       WHERE lead_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [leadId]
    )
    const callsAnswered = rows.length
    const appointmentsBooked = rows.filter((r: any) => r.transcript?.includes('[BOOKING]')).length
    const avgDurationSec = callsAnswered
      ? Math.round(rows.reduce((s: number, r: any) => s + (r.duration_seconds ?? 0), 0) / callsAnswered)
      : 0
    return { callsAnswered, appointmentsBooked, avgDurationSec }
  } catch {
    return { callsAnswered: 0, appointmentsBooked: 0, avgDurationSec: 0 }
  }
}

async function getGscData(siteUrl: string): Promise<any> {
  const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccount) return null

  const sa = JSON.parse(serviceAccount)
  const now = Math.floor(Date.now() / 1000)
  const { createSign } = await import('crypto')

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(sa.private_key, 'base64url')
  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json() as any
  const token = tokenData.access_token
  if (!token) return null

  const endDate   = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate, endDate,
        dimensions: ['query'],
        rowLimit: 10,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
      }),
    }
  )
  return res.ok ? res.json() : null
}

function buildEmailHtml(params: {
  businessName: string
  city: string
  niche: string
  siteUrl: string
  totalClicks: number
  totalImpressions: number
  avgPosition: number
  topKeywords: Array<{ keyword: string; clicks: number; impressions: number }>
  summary: string
  weekLabel: string
  callStats: CallStats
}): string {
  const { businessName, city, niche, siteUrl, totalClicks, totalImpressions, avgPosition, topKeywords, summary, weekLabel, callStats } = params
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0'
  const avgDurationLabel = callStats.avgDurationSec
    ? `${Math.floor(callStats.avgDurationSec / 60)}m ${callStats.avgDurationSec % 60}s`
    : '—'

  const kwRows = topKeywords.map(kw => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#1a1a2e;">${kw.keyword}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#1a1a2e;text-align:right;font-weight:600;">${kw.clicks}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#6b7280;text-align:right;">${kw.impressions.toLocaleString()}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0a0a1a 0%,#0d0b28 100%);border-radius:16px 16px 0 0;padding:32px 36px;text-align:center;">
      <div style="display:inline-block;background:rgba(0,194,110,0.15);border:1px solid rgba(0,194,110,0.3);border-radius:100px;padding:4px 14px;font-size:11px;font-weight:700;letter-spacing:0.12em;color:#00C26F;margin-bottom:16px;text-transform:uppercase;">
        Weekly Performance Report
      </div>
      <h1 style="margin:0 0 6px;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.03em;">${businessName}</h1>
      <p style="margin:0;color:rgba(255,255,255,0.45);font-size:13px;">${city} · ${niche} · ${weekLabel}</p>
    </div>

    <!-- Stats row -->
    <div style="background:#ffffff;padding:28px 24px;display:flex;gap:0;border-left:1px solid #e8e8ec;border-right:1px solid #e8e8ec;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="text-align:center;padding:12px;border-right:1px solid #f0f0f0;">
          <div style="font-size:28px;font-weight:800;color:#00C26F;letter-spacing:-0.04em;line-height:1;">${totalClicks.toLocaleString()}</div>
          <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Clicks</div>
        </td>
        <td style="text-align:center;padding:12px;border-right:1px solid #f0f0f0;">
          <div style="font-size:28px;font-weight:800;color:#0EA5E9;letter-spacing:-0.04em;line-height:1;">${totalImpressions.toLocaleString()}</div>
          <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Impressions</div>
        </td>
        <td style="text-align:center;padding:12px;border-right:1px solid #f0f0f0;">
          <div style="font-size:28px;font-weight:800;color:#8B5CF6;letter-spacing:-0.04em;line-height:1;">${ctr}%</div>
          <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Click Rate</div>
        </td>
        <td style="text-align:center;padding:12px;">
          <div style="font-size:28px;font-weight:800;color:#F59E0B;letter-spacing:-0.04em;line-height:1;">#${avgPosition > 0 ? avgPosition.toFixed(1) : '—'}</div>
          <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Avg Position</div>
        </td>
      </tr></table>
    </div>

    ${callStats.callsAnswered > 0 ? `
    <!-- AI Reception stats row -->
    <div style="background:#0a0a1a;padding:20px 24px;border-left:1px solid #e8e8ec;border-right:1px solid #e8e8ec;">
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;">Your AI Receptionist This Week</div>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:24px;font-weight:800;color:#00C26F;letter-spacing:-0.04em;line-height:1;">${callStats.callsAnswered}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.45);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Calls Answered</div>
        </td>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:24px;font-weight:800;color:#0EA5E9;letter-spacing:-0.04em;line-height:1;">${callStats.appointmentsBooked}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.45);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Booked</div>
        </td>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:24px;font-weight:800;color:#8B5CF6;letter-spacing:-0.04em;line-height:1;">${avgDurationLabel}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.45);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Avg Call</div>
        </td>
      </tr></table>
    </div>` : ''}

    <!-- AI Summary -->
    <div style="background:#f8fffe;border-left:3px solid #00C26F;border-right:1px solid #e8e8ec;padding:20px 24px;">
      <div style="font-size:11px;font-weight:700;color:#00C26F;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Your AI Team's Take</div>
      <p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.7;">${summary}</p>
    </div>

    ${topKeywords.length > 0 ? `
    <!-- Top Keywords -->
    <div style="background:#ffffff;border-left:1px solid #e8e8ec;border-right:1px solid #e8e8ec;">
      <div style="padding:16px 20px 0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Top Keywords Driving Clicks</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        <tr style="background:#f8f8fa;">
          <th style="padding:8px 16px;font-size:11px;color:#6b7280;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:0.08em;">Keyword</th>
          <th style="padding:8px 16px;font-size:11px;color:#6b7280;font-weight:600;text-align:right;text-transform:uppercase;letter-spacing:0.08em;">Clicks</th>
          <th style="padding:8px 16px;font-size:11px;color:#6b7280;font-weight:600;text-align:right;text-transform:uppercase;letter-spacing:0.08em;">Impressions</th>
        </tr>
        ${kwRows}
      </table>
    </div>` : ''}

    <!-- CTA -->
    <div style="background:#ffffff;border-left:1px solid #e8e8ec;border-right:1px solid #e8e8ec;padding:24px;text-align:center;">
      <a href="${siteUrl}" style="display:inline-block;background:linear-gradient(135deg,#00C26F,#0EA5E9);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:100px;letter-spacing:-0.01em;">
        View Your Live Site →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#0a0a1a;border-radius:0 0 16px 16px;padding:20px 28px;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.4);">Managed by your WebCrew AI Team · Data from Google Search Console</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">webcrew.app · Questions? Reply to this email.</p>
    </div>

  </div>
</body>
</html>`
}

export async function runAnalyticsAgent(
  lead: Lead
): Promise<AgentResult<{ report_sent: boolean }>> {
  const host = lead.cloudflare_url ?? lead.vercel_url
  if (!host || !lead.email) {
    return { success: false, error: 'No site URL or email' }
  }
  // GSC's URL-prefix properties are identified by the full "https://host/"
  // form (protocol + trailing slash), not the bare host — using the bare
  // host here always 404'd against the API regardless of whether the
  // service account had been made an owner. Prefer the exact string
  // gsc-agent.ts actually verified when we have it.
  const siteUrl = lead.gsc_site_url ?? `https://${host}/`
  const siteLink = `https://${host}`

  const periodEnd   = new Date().toISOString().split('T')[0]
  const periodStart = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  try {
    const [gscData, callStats] = await Promise.all([
      lead.gsc_verified ? getGscData(siteUrl) : Promise.resolve(null),
      lead.id ? getCallStats(lead.id) : Promise.resolve({ callsAnswered: 0, appointmentsBooked: 0, avgDurationSec: 0 }),
    ])

    const rows: any[] = gscData?.rows ?? []
    const totalClicks      = rows.reduce((s: number, r: any) => s + (r.clicks ?? 0), 0)
    const totalImpressions = rows.reduce((s: number, r: any) => s + (r.impressions ?? 0), 0)
    const avgPosition      = rows.length
      ? rows.reduce((s: number, r: any) => s + (r.position ?? 0), 0) / rows.length
      : 0

    const topKeywords = rows.slice(0, 5).map((r: any) => ({
      keyword: r.keys[0],
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
    }))

    const topKwStr = topKeywords.length
      ? topKeywords.map(k => `"${k.keyword}" (${k.clicks} clicks)`).join(', ')
      : 'not yet available (site may be recently indexed)'

    const callsLine = callStats.callsAnswered > 0
      ? `Also this week, the AI receptionist answered ${callStats.callsAnswered} calls and booked ${callStats.appointmentsBooked} appointments.`
      : ''

    const summary = await geminiText(
      `Write a brief, friendly website performance summary for ${lead.name}, a ${lead.niche} business in ${lead.city}.
Last 28 days: ${totalClicks} clicks from Google, ${totalImpressions} impressions, average position #${avgPosition > 0 ? avgPosition.toFixed(1) : 'unknown'}.
Top search terms: ${topKwStr}. ${callsLine}
3 sentences. Encouraging but specific. Mention what's working and one concrete next-step suggestion. No emojis. Sign off as "Your WebCrew AI Team".`,
      { model: GEMINI_FLASH, maxTokens: 500 }
    )

    const now = new Date()
    const weekLabel = `Week of ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    const html = buildEmailHtml({
      businessName: lead.name,
      city: `${lead.city}, ${lead.state}`,
      niche: lead.niche,
      siteUrl: siteLink,
      totalClicks,
      totalImpressions,
      avgPosition,
      topKeywords,
      summary,
      weekLabel,
      callStats,
    })

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.OUTREACH_FROM_EMAIL ?? 'reports@webcrew.app',
        to: lead.email,
        subject: `📊 ${lead.name} · Google performance this week`,
        html,
      }),
    })

    // Persist GSC snapshot to DB so client portal can show traffic trend
    if (lead.id && rows.length > 0) {
      const ctrPct = totalImpressions > 0
        ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2))
        : 0
      try {
        await pool.query(
          `INSERT INTO gsc_snapshots
             (lead_id, period_start, period_end, total_clicks, total_impressions, avg_position, ctr_pct, top_keywords)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (lead_id, period_start) DO UPDATE SET
             total_clicks      = EXCLUDED.total_clicks,
             total_impressions = EXCLUDED.total_impressions,
             avg_position      = EXCLUDED.avg_position,
             ctr_pct           = EXCLUDED.ctr_pct,
             top_keywords      = EXCLUDED.top_keywords`,
          [
            lead.id,
            periodStart,
            periodEnd,
            totalClicks,
            totalImpressions,
            avgPosition > 0 ? avgPosition.toFixed(2) : null,
            ctrPct,
            JSON.stringify(topKeywords),
          ]
        )
        console.log(`[Analytics] GSC snapshot saved for ${lead.name}`)
      } catch (e: any) {
        console.error('[Analytics] Failed to save GSC snapshot:', e.message)
      }
    }

    return { success: emailRes.ok, data: { report_sent: emailRes.ok } }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
