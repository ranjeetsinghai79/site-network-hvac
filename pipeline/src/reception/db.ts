import pg from 'pg'
import type { ReceptionConfig, BusinessBrain } from './types.js'
import { classifyTrust, ownerPhones } from './call-screen.js'

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export async function saveReceptionConfig(
  websiteUrl: string,
  businessName: string,
  brain: BusinessBrain,
  systemPrompt: string,
  leadId?: string,
  opts?: { isPreview?: boolean; previewExpiresAt?: Date }
): Promise<ReceptionConfig> {
  const isPreview = opts?.isPreview ?? false
  const previewExpiresAt = opts?.previewExpiresAt ?? null
  const { rows } = await pool.query(
    `INSERT INTO reception_configs (website_url, business_name, brain_json, system_prompt, lead_id, is_preview, preview_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (website_url) DO UPDATE SET
       business_name       = EXCLUDED.business_name,
       brain_json          = EXCLUDED.brain_json,
       system_prompt       = EXCLUDED.system_prompt,
       is_preview          = EXCLUDED.is_preview,
       preview_expires_at  = EXCLUDED.preview_expires_at,
       updated_at          = NOW()
     RETURNING *`,
    [websiteUrl, businessName, JSON.stringify(brain), systemPrompt, leadId ?? null, isPreview, previewExpiresAt]
  )
  return rowToConfig(rows[0])
}

// ── Landing-page "paste your URL" instant preview flow ────────────────────────

export interface PreviewDisplayConfig { tagline: string; theme: string }

export interface PreviewJob {
  id: string
  url: string
  stage: 'reading' | 'understanding' | 'building' | 'ready' | 'failed'
  progressPct: number
  configId: string | null
  leadId: string | null
  error: string | null
  displayConfig: PreviewDisplayConfig | null
}

function rowToPreviewJob(r: any): PreviewJob {
  return {
    id: r.id, url: r.url, stage: r.stage, progressPct: r.progress_pct,
    configId: r.config_id ?? null, leadId: r.lead_id ?? null, error: r.error ?? null,
    displayConfig: r.display_config ?? null,
  }
}

export async function createPreviewJob(url: string, ipAddress: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO preview_jobs (url, ip_address) VALUES ($1, $2) RETURNING id`,
    [url, ipAddress]
  )
  return rows[0].id
}

export async function getPreviewJob(id: string): Promise<PreviewJob | null> {
  const { rows } = await pool.query(`SELECT * FROM preview_jobs WHERE id = $1`, [id])
  return rows[0] ? rowToPreviewJob(rows[0]) : null
}

export async function updatePreviewJob(id: string, fields: Partial<{ stage: PreviewJob['stage']; progressPct: number; configId: string; leadId: string; error: string; displayConfig: PreviewDisplayConfig }>): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  let i = 1
  if (fields.stage !== undefined)         { sets.push(`stage = $${i++}`);          values.push(fields.stage) }
  if (fields.progressPct !== undefined)   { sets.push(`progress_pct = $${i++}`);   values.push(fields.progressPct) }
  if (fields.configId !== undefined)      { sets.push(`config_id = $${i++}`);      values.push(fields.configId) }
  if (fields.leadId !== undefined)        { sets.push(`lead_id = $${i++}`);        values.push(fields.leadId) }
  if (fields.error !== undefined)         { sets.push(`error = $${i++}`);          values.push(fields.error) }
  if (fields.displayConfig !== undefined) { sets.push(`display_config = $${i++}`); values.push(JSON.stringify(fields.displayConfig)) }
  if (sets.length === 0) return
  values.push(id)
  await pool.query(`UPDATE preview_jobs SET ${sets.join(', ')} WHERE id = $${i}`, values)
}

/** Sliding-window IP+endpoint rate limit, same table/semantics as api/src/index.ts's isRateLimited() — reused here via the reception server's own pg.Pool instead of the Worker's neonQuery. */
export async function isRateLimited(ipAddress: string, endpoint: string, limit: number, windowMinutes: number): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM public_form_submissions WHERE ip_address = $1 AND endpoint = $2 AND created_at > NOW() - ($3 || ' minutes')::interval`,
      [ipAddress, endpoint, String(windowMinutes)]
    )
    if ((rows[0]?.n ?? 0) >= limit) return true
    await pool.query(`INSERT INTO public_form_submissions (ip_address, endpoint) VALUES ($1, $2)`, [ipAddress, endpoint])
    return false
  } catch (e: any) {
    console.warn('[RateLimit] check failed, failing open:', e.message)
    return false
  }
}

export async function getReceptionConfig(websiteUrl: string): Promise<ReceptionConfig | null> {
  const { rows } = await pool.query(
    `SELECT * FROM reception_configs WHERE website_url = $1 AND active = true LIMIT 1`,
    [websiteUrl]
  )
  return rows[0] ? rowToConfig(rows[0]) : null
}

// Last-known-good config per line. A phone call needs its config before the AI can say a word, so a database
// outage (or a cold start that fails) used to mean dead air. The cache is ONLY a fallback when the database errors:
// normal reads still go to the database, so owner edits (transfer number, calendar, hours) apply immediately.
const configCache = new Map<string, { config: ReceptionConfig; at: number }>()
const CONFIG_STALE_MS = 24 * 3600_000

/** Cached config for a line, if one was read in the last 24 h. Used by the outage fallback to find the owner's cell. */
export function peekCachedConfig(id: string): ReceptionConfig | null {
  const hit = configCache.get(id)
  return hit && Date.now() - hit.at < CONFIG_STALE_MS ? hit.config : null
}

/** Load every active line into the fallback cache at startup, so even a restart during an outage can still answer. */
export async function warmConfigCache(): Promise<number> {
  const { rows } = await pool.query(`SELECT * FROM reception_configs WHERE active = true`)
  for (const r of rows) { const c = rowToConfig(r); configCache.set(c.id, { config: c, at: Date.now() }) }
  return rows.length
}

export async function getReceptionConfigById(id: string): Promise<ReceptionConfig | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reception_configs WHERE id = $1 LIMIT 1`,
      [id]
    )
    const config = rows[0] ? rowToConfig(rows[0]) : null
    if (config) configCache.set(id, { config, at: Date.now() })
    return config
  } catch (e: any) {
    const stale = peekCachedConfig(id)
    if (stale) { console.warn(`[DB] config lookup failed (${e.message}) — serving last-known-good config for ${id}`); return stale }
    throw e
  }
}

export async function listReceptionConfigs(): Promise<ReceptionConfig[]> {
  const { rows } = await pool.query(
    `SELECT * FROM reception_configs ORDER BY created_at DESC`
  )
  return rows.map(rowToConfig)
}

export async function updateTwilioPhone(id: string, phone: string): Promise<void> {
  await pool.query(
    `UPDATE reception_configs SET twilio_phone = $2, updated_at = NOW() WHERE id = $1`,
    [id, phone]
  )
}

/** Create or enrich a lead from a live WebCrew Reception test call. */
export async function upsertReceptionLead(opts: {
  caller: string
  name: string
  email?: string
  niche?: string
  configId: string
  notes?: string
  smsConsent?: boolean
}): Promise<string | null> {
  const digits = opts.caller.replace(/\D/g, '')
  if (digits.length < 10) return null
  const phone = `+1${digits.slice(-10)}`
  const placeId = `voice_${digits.slice(-10)}`
  try {
    const { rows } = await pool.query(
      `INSERT INTO leads (place_id, name, phone, email, niche, status, source, reception_config_id)
       VALUES ($1,$2,$3,$4,$5,'interested','ai_reception',$6)
       ON CONFLICT (phone) WHERE phone IS NOT NULL DO UPDATE SET
         name = CASE WHEN $2 <> '' THEN $2 ELSE leads.name END,
         phone = COALESCE(NULLIF($3,''), leads.phone),
         email = COALESCE(NULLIF($4,''), leads.email),
         niche = COALESCE(NULLIF($5,''), leads.niche),
         status = CASE WHEN leads.status IN ('paid','handed_off') THEN leads.status ELSE 'interested' END,
         reception_config_id = COALESCE($6, leads.reception_config_id),
         updated_at = NOW()
       RETURNING id`,
      [placeId, opts.name.trim() || 'WebCrew test caller', phone, opts.email?.trim() || null, opts.niche?.trim() || null, opts.configId]
    )
    const leadId = rows[0]?.id ?? null
    if (leadId) {
      await pool.query(
        `INSERT INTO lead_events (lead_id, event_type, detail) VALUES ($1,'reception_qualified',$2)`,
        [leadId, JSON.stringify({ phone, name: opts.name, email: opts.email ?? null, niche: opts.niche ?? null, notes: opts.notes ?? null })]
      ).catch(e => console.error('[DB] reception lead event failed:', e.message))
      if (opts.smsConsent === true) {
        await pool.query(
          `INSERT INTO consent_events (lead_id, channel, contact, consent_type, source, consent_text)
           SELECT $1,'sms',$2,'express_written','ai_reception',$3
           WHERE NOT EXISTS (SELECT 1 FROM consent_events WHERE channel='sms' AND contact=$2 AND revoked_at IS NULL)`,
          [leadId, phone, 'Caller verbally opted in to recurring WebCrew SMS updates. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.']
        ).catch(e => console.error('[DB] reception SMS consent failed:', e.message))
      }
    }
    return leadId
  } catch (e: any) {
    console.error('[DB] reception lead upsert failed:', e.message)
    return null
  }
}

export async function getLeadContact(leadId: string): Promise<{ email: string | null; phone: string | null; name: string | null } | null> {
  try {
    const { rows } = await pool.query(
      `SELECT email, phone, name FROM leads WHERE id = $1 LIMIT 1`,
      [leadId]
    )
    if (!rows.length) return null
    return { email: rows[0].email ?? null, phone: rows[0].phone ?? null, name: rows[0].name ?? null }
  } catch (e: any) {
    console.error('[DB] getLeadContact failed:', e.message)
    return null
  }
}

export async function insertCallLog(opts: {
  configId:    string
  leadId?:     string
  caller:      string | null
  durationSec: number
  transcript:  string
  escalated:   boolean
  message?:    string
  callSid?:    string
  /** Raw Twilio StirVerstat for the call, when known. */
  stir?:       string | null
  channel?:    'phone' | 'widget'
  gatePassed?: boolean
  /** The line's own number(s), so a call from the line itself is labelled 'self'. */
  selfNumbers?: Array<string | null | undefined>
}): Promise<string | null> {
  const trust = classifyTrust({
    caller: opts.caller, channel: opts.channel, ownerPhones: ownerPhones(), selfNumbers: opts.selfNumbers,
    transcript: opts.transcript, stir: opts.stir, gatePassed: opts.gatePassed,
  })
  const { rows } = await pool.query(
    `INSERT INTO call_logs
       (reception_config_id, lead_id, caller_number, duration_seconds, transcript, escalated, message_taken, call_sid, stir_verstat, trust)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [opts.configId, opts.leadId ?? null, opts.caller, opts.durationSec, opts.transcript, opts.escalated, opts.message ?? null, opts.callSid ?? null, opts.stir || null, trust]
  )
  const callLogId = rows[0]?.id ?? null

  if (!opts.leadId) return callLogId
  const booked  = opts.transcript.includes('[BOOKING]')
  const isSpam  = opts.durationSec < 8 && (
    opts.transcript.toLowerCase().includes('vendor') ||
    opts.transcript.toLowerCase().includes('not accepting') ||
    opts.transcript.length < 80
  )
  try {
    await pool.query(
      `INSERT INTO lead_events (lead_id, event_type, detail) VALUES ($1, $2, $3)`,
      [opts.leadId, isSpam ? 'call_spam' : 'call_received', JSON.stringify({ caller: opts.caller, durationSec: opts.durationSec })]
    )
    if (booked) {
      await pool.query(
        `INSERT INTO lead_events (lead_id, event_type, detail) VALUES ($1, $2, $3)`,
        [opts.leadId, 'call_booked', JSON.stringify({ caller: opts.caller })]
      )
    }
    if (opts.escalated) {
      await pool.query(
        `INSERT INTO lead_events (lead_id, event_type, detail) VALUES ($1, $2, $3)`,
        [opts.leadId, 'call_escalated', JSON.stringify({ caller: opts.caller })]
      )
    }
  } catch (e: any) {
    console.error('[DB] lead_events insert failed:', e.message)
  }
  return callLogId
}

/** Stamps the Twilio recording URL onto a call once it finishes rendering (async, arrives after the call ends). */
export async function updateCallLogRecording(callSid: string, recordingUrl: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE call_logs SET recording_url = $2 WHERE call_sid = $1 AND recording_url IS NULL`,
      [callSid, recordingUrl]
    )
  } catch (e: any) {
    console.error('[DB] call recording update failed:', e.message)
  }
}

/** Persists the post-call classification (client lines): what the caller wanted, how urgent, and what actually happened. */
export async function updateCallLogClassification(callLogId: string, intent: string, urgency: string, route: string): Promise<void> {
  try {
    await pool.query(`UPDATE call_logs SET intent = $2, urgency = $3, route = $4 WHERE id = $1`, [callLogId, intent, urgency, route])
  } catch (e: any) {
    console.error('[DB] call classification update failed:', e.message)
  }
}

/** Persists the Gemini-generated summary + sentiment for a completed call. */
export async function updateCallLogInsights(callLogId: string, summary: string, sentiment: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE call_logs SET summary = $2, sentiment = $3 WHERE id = $1`,
      [callLogId, summary, sentiment]
    )
  } catch (e: any) {
    console.error('[DB] call insights update failed:', e.message)
  }
}

/**
 * Per-phone throttle for the start_trial tool — a caller (or a scripted probe
 * hitting the ad's demo line) shouldn't be able to trigger unlimited real
 * Twilio SMS sends with a live Stripe checkout link. Fails open on DB error,
 * same convention as every other consent/rate-limit check in this codebase.
 */
export async function isTrialStartRateLimited(phone: string, limit = 2, windowMinutes = 1440): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM trial_start_attempts WHERE phone = $1 AND created_at > NOW() - ($2 || ' minutes')::interval`,
      [phone, String(windowMinutes)]
    )
    if ((rows[0]?.n ?? 0) >= limit) return true
    await pool.query(`INSERT INTO trial_start_attempts (phone) VALUES ($1)`, [phone])
    return false
  } catch (e: any) {
    console.error('[DB] trial rate limit check failed (failing open):', e.message)
    return false
  }
}

/**
 * Short-link redirect for SMS-texted URLs (Stripe checkout links are long).
 * Same `short_links` table the api.webcrew.app Worker's /s/:code route
 * reads — shared Neon DB, not a duplicate mechanism. Falls back to the
 * original long URL if the insert fails, so a Neon hiccup never blocks a
 * real send. TTL matches Stripe Checkout Session's own default 24h expiry.
 */
export async function createShortLink(targetUrl: string): Promise<string> {
  try {
    const code = Math.random().toString(16).slice(2, 10)
    const { rows } = await pool.query(
      `INSERT INTO short_links (code, target_url, expires_at) VALUES ($1, $2, NOW() + interval '24 hours') RETURNING code`,
      [code, targetUrl]
    )
    if (!rows[0]) return targetUrl
    return `https://api.webcrew.app/s/${code}`
  } catch (e: any) {
    console.error('[DB] short link creation failed (falling back to long URL):', e.message)
    return targetUrl
  }
}

// Voice and SMS used to be two fully separate memory silos for the same
// phone number — a lead mid-negotiation with Sofia by text who then called
// in got a voice agent with zero awareness of that conversation. Both
// api/src/index.ts (the Worker) and this file connect to the SAME Neon
// Postgres (env DATABASE_URL) — sms_conversations is a plain cross-table
// query here, not a cross-service call. See the symmetric fix in
// api/src/index.ts's handleSMSWebhook (pulls call_logs the same way).
export async function getRecentCallerContext(caller: string, configId: string): Promise<string> {
  const digits = caller.replace(/\D/g, '')
  if (digits.length < 10) return ''
  const e164 = `+1${digits.slice(-10)}`
  const parts: string[] = []
  try {
    const { rows } = await pool.query(
      `SELECT created_at, transcript, message_taken FROM call_logs
       WHERE reception_config_id=$1 AND caller_number=$2
       ORDER BY created_at DESC LIMIT 3`,
      [configId, e164]
    )
    if (rows.length) {
      parts.push(rows.map((r: any) => `Previous call ${r.created_at}: ${(r.transcript || r.message_taken || '').slice(-1800)}`).join('\n'))
    }
  } catch (e: any) {
    console.error('[DB] caller history lookup failed:', e.message)
  }
  try {
    const { rows } = await pool.query(
      `SELECT stage, desired_plan, last_message, last_reply, updated_at FROM sms_conversations WHERE phone=$1`,
      [e164]
    )
    const sms = rows[0]
    if (sms && sms.stage && sms.stage !== 'closed') {
      parts.push(`Ongoing SMS conversation with Sofia (as of ${sms.updated_at}) — stage: ${sms.stage}${sms.desired_plan ? `, interested in: ${sms.desired_plan}` : ''}. They last said: "${(sms.last_message || '').slice(0, 300)}". Sofia last replied: "${(sms.last_reply || '').slice(0, 300)}".`)
    }
  } catch (e: any) {
    console.error('[DB] SMS conversation lookup failed:', e.message)
  }
  return parts.join('\n\n')
}

export async function startEmailVerification(phone: string, callSid: string, configId: string): Promise<void> {
  await pool.query(
    `INSERT INTO reception_email_verifications (phone, call_sid, config_id)
     VALUES ($1,$2,$3)
     ON CONFLICT (phone) WHERE status='pending' DO UPDATE SET
       call_sid=EXCLUDED.call_sid, config_id=EXCLUDED.config_id,
       email=NULL, status='pending', expires_at=NOW()+INTERVAL '10 minutes',
       created_at=NOW(), verified_at=NULL`,
    [phone, callSid, configId]
  )
}

export async function getVerifiedEmail(callSid: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT email FROM reception_email_verifications
     WHERE call_sid=$1 AND status='verified' AND expires_at>NOW()
     ORDER BY verified_at DESC LIMIT 1`,
    [callSid]
  )
  return rows[0]?.email ?? null
}

/** Today's call count for a given AI Studio key (0 if no calls yet today). */
export async function getAiStudioUsageToday(keyName: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT call_count FROM ai_studio_key_usage WHERE key_name = $1 AND usage_date = CURRENT_DATE`,
    [keyName]
  )
  return rows[0]?.call_count ?? 0
}

/** Atomically records one call against a key's daily counter, returns the new count. */
export async function incrementAiStudioUsage(keyName: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO ai_studio_key_usage (key_name, usage_date, call_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (key_name, usage_date) DO UPDATE SET
       call_count = ai_studio_key_usage.call_count + 1,
       updated_at = NOW()
     RETURNING call_count`,
    [keyName]
  )
  return rows[0].call_count
}

/** Calls from one number to one line in the last 24h — the per-number cap for WebCrew's own lines. */
export async function countRecentCallsFromNumber(configId: string, caller: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM call_logs
     WHERE reception_config_id = $1 AND caller_number = $2 AND created_at > NOW() - INTERVAL '24 hours'`,
    [configId, caller]
  )
  return rows[0]?.n ?? 0
}

/** Voice seconds a line has used in the last 24h — the daily budget kill switch for WebCrew's own lines. */
export async function getRecentVoiceSeconds(configId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(duration_seconds), 0)::int AS s FROM call_logs
     WHERE reception_config_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [configId]
  )
  return rows[0]?.s ?? 0
}

/** Total AI Reception voice minutes for a config, current calendar month. */
export async function getMonthlyVoiceMinutes(configId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(duration_seconds), 0) AS total_sec
     FROM call_logs
     WHERE reception_config_id = $1 AND created_at >= date_trunc('month', NOW())`,
    [configId]
  )
  return Math.round((Number(rows[0]?.total_sec) || 0) / 60)
}

/**
 * Records the voice-cap-exceeded alert for this config this month.
 * Returns true the first time it's called in a given month (caller should
 * send the alert email), false on every subsequent call that month (already
 * sent — skip, don't spam an email per over-cap call).
 */
export async function markCapAlertSent(configId: string, minutesUsed: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO reception_cap_alerts (config_id, alert_month, minutes_used)
     VALUES ($1, date_trunc('month', NOW())::date, $2)
     ON CONFLICT (config_id, alert_month) DO NOTHING`,
    [configId, minutesUsed]
  )
  return (rowCount ?? 0) > 0
}

/** Today's widget session count for an IP (0 if none yet). */
export async function getWidgetSessionCountToday(ip: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT session_count FROM widget_session_usage WHERE ip_address = $1 AND usage_date = CURRENT_DATE`,
    [ip]
  )
  return rows[0]?.session_count ?? 0
}

/** Atomically records one widget session against an IP's daily counter, returns the new count. */
export async function incrementWidgetSessionCount(ip: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO widget_session_usage (ip_address, usage_date, session_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (ip_address, usage_date) DO UPDATE SET
       session_count = widget_session_usage.session_count + 1,
       updated_at    = NOW()
     RETURNING session_count`,
    [ip]
  )
  return rows[0].session_count
}

function rowToConfig(row: any): ReceptionConfig {
  return {
    id:            row.id,
    lead_id:       row.lead_id,
    website_url:   row.website_url,
    business_name: row.business_name,
    brain:         row.brain_json,
    system_prompt: row.system_prompt,
    twilio_phone:  row.twilio_phone,
    cal_api_key:       row.cal_api_key ?? null,
    cal_event_type_id: row.cal_event_type_id ?? null,
    timezone:          row.timezone ?? null,
    calendar_provider: row.calendar_provider ?? null,
    google_refresh_token_enc: row.google_refresh_token_enc ?? null,
    google_account_email: row.google_account_email ?? null,
    calendar_settings: row.calendar_settings ?? null,
    widget_allowed_origins: row.widget_allowed_origins ?? null,
    active:        row.active,
    created_at:    row.created_at,
  }
}
