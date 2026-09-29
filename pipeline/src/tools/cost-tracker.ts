/**
 * cost-tracker.ts
 * Log and query pipeline spend.
 * Call logCost() from any agent after each paid API call.
 *
 * Service pricing (update as plans change):
 *   vertex_images $0.04000  per image  (Vertex AI Imagen 3 — billed to GCP credits)
 *   fal_images   $0.04000  per image  (Flux Pro 1.1 — fallback when Imagen 3 fails)
 *   kling_video  $0.09800  per video  (Kling 1.6 Pro image-to-video — actual fal.ai billing)
 *   reel_video   $0.14000  per second (Kling 2.6 Pro image-to-video w/ native audio, fal.ai — logged as units=duration_sec, so a 10s reel = $1.40)
 *   places_api   $0.05000  per request (Advanced Data fields, Text Search v1)
 *   pagespeed    $0.00000  free
 *   firecrawl    $0.00000  free tier ≤500/month
 *   gemini       $0.00000  Vertex AI Gemini (billed to GCP credits — $1k available)
 *   pexels       $0.00000  free (200 req/hr) — pexels.com/api
 *   pixabay      $0.00000  free — pixabay.com/api
 *   flickr       $0.00000  free (3600 req/hr, CC-licensed) — flickr.com/services
 *   freepik      $0.00000  free tier — freepik.com/api
 *   unsplash     $0.00000  free (50 req/hr demo) — unsplash.com/developers
 *   twilio_sms   $0.00790  per SMS segment
 *   resend_email $0.00000  free tier ≤3000/month
 *   cloudflare   $0.00000  Pages free tier
 *   github       $0.00000  free public repos
 *   neon_db      $0.00000  free tier
 *   twilio_voice_leg  $0.00850  per minute (Twilio published US inbound voice rate — verify at twilio.com/voice/pricing before trusting at volume)
 *   gemini_live_voice $0.00000  ⚠️ UNCONFIRMED — set the real per-minute rate here from ai.google.dev/pricing (Gemini Live native audio) before trusting margin numbers.
 *                               Logged with force:true regardless (see logCost) so minute counts are captured now — dollar total fills in once this is set.
 */

import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export type CostService =
  | 'vertex_images'
  | 'fal_images'
  | 'kling_video'
  | 'reel_video'
  | 'places_api'
  | 'pagespeed'
  | 'firecrawl'
  | 'gemini'
  | 'twilio_sms'
  | 'resend_email'
  | 'cloudflare'
  | 'github'
  | 'neon_db'
  | 'twilio_voice_leg'
  | 'gemini_live_voice'

/** Unit cost in USD for each service */
export const UNIT_COSTS: Record<CostService, number> = {
  vertex_images: 0.04000,
  fal_images:    0.04000,
  kling_video:   0.09800,
  reel_video:    0.14000,
  places_api:   0.05000,
  pagespeed:    0.00000,
  firecrawl:    0.00000,
  gemini:       0.00000,
  twilio_sms:   0.00790,
  resend_email: 0.00000,
  cloudflare:   0.00000,
  github:       0.00000,
  neon_db:      0.00000,
  twilio_voice_leg:  0.00850,
  gemini_live_voice: 0.00000, // unconfirmed — see comment above
}

export async function logCost(params: {
  service:   CostService
  units?:    number          // default 1
  leadId?:   string
  leadName?: string
  note?:     string
  force?:    boolean         // log even at $0 unit cost — for services whose real rate isn't confirmed yet, so usage isn't silently invisible
}): Promise<void> {
  const { service, units = 1, leadId, leadName, note, force = false } = params
  const unitCost = UNIT_COSTS[service]
  if (unitCost === 0 && !force) return  // skip genuinely free services — no noise in DB

  try {
    await pool.query(
      `INSERT INTO pipeline_costs (service, units, unit_cost_usd, lead_id, lead_name, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [service, units, unitCost, leadId ?? null, leadName ?? null, note ?? null]
    )
    if (leadId) {
      await pool.query(
        `INSERT INTO usage_events (agency_id,workspace_id,service,operation,quantity,unit_cost_usd,idempotency_key,metadata)
         SELECT gw.agency_id,gw.id,$2,'pipeline_api', $3,$4,$5,$6
         FROM growth_workspaces gw WHERE gw.lead_id=$1 AND gw.agency_id IS NOT NULL
         ON CONFLICT (agency_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [leadId, service, units, unitCost, `${service}:${leadId}:${Date.now()}`, JSON.stringify({ leadName, note })]
      )
    }
  } catch (e: any) {
    // Never let cost tracking break the pipeline
    console.warn(`[CostTracker] log failed: ${e.message}`)
  }
}

export interface DailySpend {
  date:         string
  service:      string
  units:        number
  total_usd:    number
}

export interface DailySummary {
  date:      string
  total_usd: number
  services:  DailySpend[]
}

export async function getDailySpend(days = 30): Promise<DailySummary[]> {
  const { rows } = await pool.query<{
    date: string
    service: string
    units: string
    total_usd: string
  }>(
    `SELECT
       date::text,
       service,
       SUM(units)::integer           AS units,
       SUM(total_usd)::numeric(10,5) AS total_usd
     FROM pipeline_costs
     WHERE date >= CURRENT_DATE - ($1 || ' days')::interval
     GROUP BY date, service
     ORDER BY date DESC, service`,
    [days]
  )

  // Group by date
  const byDate = new Map<string, DailySummary>()
  for (const r of rows) {
    if (!byDate.has(r.date)) {
      byDate.set(r.date, { date: r.date, total_usd: 0, services: [] })
    }
    const day = byDate.get(r.date)!
    const spend: DailySpend = {
      date:      r.date,
      service:   r.service,
      units:     Number(r.units),
      total_usd: Number(r.total_usd),
    }
    day.services.push(spend)
    day.total_usd += spend.total_usd
  }

  return Array.from(byDate.values())
}

export async function getTotalSpend(): Promise<{
  total_usd: number
  by_service: Record<string, { units: number; total_usd: number }>
}> {
  const { rows } = await pool.query(
    `SELECT service, SUM(units)::integer AS units, SUM(total_usd)::numeric(10,5) AS total_usd
     FROM pipeline_costs
     GROUP BY service`
  )

  const by_service: Record<string, { units: number; total_usd: number }> = {}
  let total_usd = 0
  for (const r of rows) {
    by_service[r.service] = { units: Number(r.units), total_usd: Number(r.total_usd) }
    total_usd += Number(r.total_usd)
  }
  return { total_usd, by_service }
}
