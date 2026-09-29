import pg from 'pg'
import type { Lead } from '../types.js'
import { fireStatusWebhook } from '../tools/webhook.js'

const { Pool } = pg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function rowToLead(row: any): Lead {
  return {
    id:                  row.id,
    place_id:            row.place_id,
    name:                row.name,
    phone:               row.phone,
    email:               row.email,
    website:             row.website,
    address:             row.address,
    city:                row.city,
    state:               row.state,
    zip:                 row.zip,
    niche:               row.niche,
    tier:                row.tier,
    // ── Places API fields ─────────────────────────────────────────────────
    rating:              row.rating        != null ? parseFloat(row.rating)        : undefined,
    review_count:        row.review_count  != null ? parseInt(row.review_count)    : undefined,
    international_phone: row.international_phone,
    business_status:     row.business_status,
    primary_type:        row.primary_type,
    editorial_summary:   row.editorial_summary,
    open_now:            row.open_now,
    weekday_hours:       row.weekday_hours,
    photo_count:         row.photo_count   != null ? parseInt(row.photo_count)     : undefined,
    photo_names:         row.photo_names   ?? undefined,
    google_reviews:      row.google_reviews ?? undefined,
    price_level:         row.price_level,
    google_maps_uri:     row.google_maps_uri,
    latitude:            row.latitude      != null ? parseFloat(row.latitude)      : undefined,
    longitude:           row.longitude     != null ? parseFloat(row.longitude)     : undefined,
    // ── Pipeline enrichment ───────────────────────────────────────────────
    gbp_claimed:         row.gbp_claimed,
    site_score:          row.site_score,
    site_issues:         row.site_issues,
    brand_data:          row.brand_data,
    config_ts:           row.config_ts,
    github_repo:         row.github_repo,
    vercel_url:          row.vercel_url,
    cloudflare_url:      row.cloudflare_url,
    hero_video_url:      row.hero_video_url,
    outreach_sent:       row.outreach_sent,
    outreach_sent_at:    row.outreach_sent_at,
    sms_sent:            row.sms_sent,
    sms_sent_at:         row.sms_sent_at,
    sms_opt_out:         row.sms_opt_out,
    meeting_url:         row.meeting_url,
    meeting_scheduled_at: row.meeting_scheduled_at,
    stripe_payment_url:  row.stripe_payment_url,
    stripe_session_id:   row.stripe_session_id,
    paid:                row.paid,
    paid_at:             row.paid_at,
    handed_off:          row.handed_off,
    handed_off_at:       row.handed_off_at,
    status:              row.status,
    created_at:          row.created_at,
  }
}

export async function saveLead(lead: Lead): Promise<Lead | null> {
  try {
    // If a lead with the same phone already exists, reuse its place_id so the
    // ON CONFLICT (place_id) clause merges instead of creating a duplicate.
    // This fires when the same business appears in multiple search results and
    // extractPlaceId() returns different scraped_XXXXX hashes each time.
    if (lead.phone) {
      const dup = await pool.query(
        'SELECT place_id FROM leads WHERE phone = $1 LIMIT 1',
        [lead.phone]
      )
      if (dup.rows.length > 0) lead = { ...lead, place_id: dup.rows[0].place_id }
    }

    const { rows } = await pool.query(
      `INSERT INTO leads (
         place_id, name, phone, email, website, address, city, state, zip, niche,
         tier, rating, review_count, gbp_claimed,
         international_phone, business_status, primary_type, editorial_summary,
         open_now, weekday_hours, photo_count, photo_names, google_reviews,
         price_level, google_maps_uri, latitude, longitude, status
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,
         $15,$16,$17,$18,
         $19,$20,$21,$22,$23,
         $24,$25,$26,$27,$28
       )
       ON CONFLICT (place_id) DO UPDATE SET
         name=$2, phone=$3, email=$4, website=$5,
         address=$6, city=$7, state=$8, zip=$9,
         tier=$11, rating=$12, review_count=$13, gbp_claimed=$14,
         international_phone=$15, business_status=$16, primary_type=$17,
         editorial_summary=$18, open_now=$19, weekday_hours=$20,
         photo_count=$21, photo_names=$22, google_reviews=$23,
         price_level=$24, google_maps_uri=$25,
         latitude=$26, longitude=$27,
         status = CASE
           WHEN leads.status IN ('built','deployed','outreach_sent','sms_sent',
                                 'conversation_active','meeting_scheduled',
                                 'payment_link_sent','paid','handed_off')
           THEN leads.status
           ELSE $28
         END
       RETURNING *`,
      [
        lead.place_id, lead.name,
        lead.phone ?? null, lead.email ?? null, lead.website ?? null,
        lead.address, lead.city, lead.state, lead.zip ?? null, lead.niche,
        lead.tier ?? null, lead.rating ?? null, lead.review_count ?? null, lead.gbp_claimed ?? null,
        lead.international_phone ?? null, lead.business_status ?? null,
        lead.primary_type ?? null, lead.editorial_summary ?? null,
        lead.open_now ?? null,
        lead.weekday_hours ? JSON.stringify(lead.weekday_hours) : null,
        lead.photo_count ?? null,
        lead.photo_names?.length ? lead.photo_names : null,
        lead.google_reviews?.length ? JSON.stringify(lead.google_reviews) : null,
        lead.price_level ?? null, lead.google_maps_uri ?? null,
        lead.latitude ?? null, lead.longitude ?? null,
        lead.status,
      ]
    )
    return rows[0] ? rowToLead(rows[0]) : null
  } catch (e: any) {
    console.error('[DB] save error:', e.message)
    return null
  }
}

export async function updateLead(lead: Lead): Promise<void> {
  if (!lead.id) return
  try {
    await pool.query(
      `UPDATE leads SET
         email=$1, phone=$2,
         site_score=$3, site_issues=$4, brand_data=$5, config_ts=$6,
         github_repo=$7, vercel_url=$8, cloudflare_url=$9, hero_video_url=$10,
         custom_domain=$11,
         outreach_sent=$12, outreach_sent_at=$13,
         sms_sent=$14, sms_sent_at=$15, sms_opt_out=$16,
         meeting_url=$17, meeting_scheduled_at=$18,
         stripe_payment_url=$19, stripe_session_id=$20,
         paid=$21, paid_at=$22, handed_off=$23, handed_off_at=$24,
         status=$25,
         reception_config_id=$27, reception_phone=$28,
         gsc_verified=$29, gsc_site_url=$30, gsc_verified_at=$31
       WHERE id=$26`,
      [
        lead.email ?? null, lead.phone ?? null,
        lead.site_score ?? null,
        lead.site_issues ? JSON.stringify(lead.site_issues) : null,
        lead.brand_data  ? JSON.stringify(lead.brand_data)  : null,
        lead.config_ts   ?? null,
        lead.github_repo ?? null, lead.vercel_url ?? null, lead.cloudflare_url ?? null,
        lead.hero_video_url ?? null, lead.custom_domain ?? null,
        lead.outreach_sent ?? null, lead.outreach_sent_at ?? null,
        lead.sms_sent ?? null, lead.sms_sent_at ?? null, lead.sms_opt_out ?? null,
        lead.meeting_url ?? null, lead.meeting_scheduled_at ?? null,
        lead.stripe_payment_url ?? null, lead.stripe_session_id ?? null,
        lead.paid ?? null, lead.paid_at ?? null,
        lead.handed_off ?? null, lead.handed_off_at ?? null,
        lead.status, lead.id,
        lead.reception_config_id ?? null, lead.reception_phone ?? null,
        lead.gsc_verified ?? null, lead.gsc_site_url ?? null, lead.gsc_verified_at ?? null,
      ]
    )
    // Fire CRM webhook on status change (Scale clients)
    if (lead.status) fireStatusWebhook(lead, lead.status).catch(() => {})
  } catch (e: any) {
    console.error('[DB] update error:', e.message)
  }
}

// Clears gbp_account_id/gbp_location_id after Google returns 403 (client
// removed our service account as Manager) — prevents retention.ts from
// erroring on this lead forever until someone notices.
export async function clearGbpCredentials(id: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE leads SET gbp_account_id = NULL, gbp_location_id = NULL WHERE id = $1`,
      [id]
    )
  } catch (e: any) {
    console.error('[DB] clearGbpCredentials error:', e.message)
  }
}

export async function getLeadById(id: string): Promise<Lead | null> {
  try {
    const { rows } = await pool.query(`SELECT * FROM leads WHERE id = $1 LIMIT 1`, [id])
    return rows[0] ? rowToLead(rows[0]) : null
  } catch {
    return null
  }
}

export async function getAllLeads(limit = 5000): Promise<Lead[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM leads ORDER BY created_at DESC LIMIT $1`,
      [limit]
    )
    return rows.map(rowToLead)
  } catch {
    return []
  }
}

export async function getTotalLeadCount(): Promise<number> {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM leads`)
    return parseInt(rows[0]?.count ?? '0')
  } catch {
    return 0
  }
}

export async function leadExists(placeId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM leads WHERE place_id=$1 LIMIT 1`,
      [placeId]
    )
    return rows.length > 0
  } catch {
    return false
  }
}

export async function getLeadsByStatus(status: string): Promise<Lead[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM leads WHERE status=$1 ORDER BY created_at DESC`,
      [status]
    )
    return rows.map(rowToLead)
  } catch (e: any) {
    console.error('[DB] query error:', e.message)
    return []
  }
}

// ── Lead activity timeline (email opens/clicks, SMS replies, calls, bookings) ─

export type LeadEventType =
  | 'email_sent' | 'email_opened' | 'email_clicked' | 'email_bounced'
  | 'sms_sent'   | 'sms_replied'  | 'sms_opted_out'
  | 'call_received' | 'call_booked' | 'call_escalated'

export async function logLeadEvent(
  leadId: string,
  eventType: LeadEventType,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO lead_events (lead_id, event_type, detail) VALUES ($1, $2, $3)`,
      [leadId, eventType, detail ? JSON.stringify(detail) : null]
    )
  } catch (e: any) {
    console.error('[DB] logLeadEvent failed:', e.message)
  }
}

export async function getLeadEvents(leadId: string): Promise<Array<{
  id: string; event_type: string; detail: any; created_at: string
}>> {
  try {
    const { rows } = await pool.query(
      `SELECT id, event_type, detail, created_at FROM lead_events WHERE lead_id=$1 ORDER BY created_at DESC`,
      [leadId]
    )
    return rows
  } catch (e: any) {
    console.error('[DB] getLeadEvents failed:', e.message)
    return []
  }
}

export async function findLeadIdByEmail(email: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(`SELECT id FROM leads WHERE email=$1 LIMIT 1`, [email])
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}

export async function findLeadIdByPhone(phone: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM leads WHERE phone=$1 OR international_phone=$1 LIMIT 1`,
      [phone]
    )
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}
