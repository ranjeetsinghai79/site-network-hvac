/**
 * webhook.ts — Zapier-compatible CRM sync webhook
 *
 * Fires a POST to the client's configured webhook_url on status changes.
 * Standard event payload — works natively with Zapier, Make, HubSpot, GoHighLevel, etc.
 *
 * Setup per Scale client: set lead.webhook_url in DB.
 * Test: npx tsx src/scripts/test-webhook.ts <lead_id>
 */

import pg from 'pg'
import type { Lead } from '../types.js'

const { Pool } = pg
let _pool: InstanceType<typeof Pool> | null = null
function getPool() {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  return _pool
}

// ─── Event types ──────────────────────────────────────────────────────────────

export type WebhookEvent =
  | 'lead.deployed'
  | 'lead.outreach_sent'
  | 'lead.sms_sent'
  | 'lead.conversation_active'
  | 'lead.meeting_scheduled'
  | 'lead.payment_link_sent'
  | 'lead.paid'
  | 'lead.change_request'

export interface WebhookPayload {
  event:      WebhookEvent
  timestamp:  string
  lead: {
    id:         string
    name:       string
    email?:     string
    phone?:     string
    niche:      string
    city:       string
    state:      string
    address?:   string
    website?:   string
    site_url:   string
    status:     string
    client_plan: string
  }
  data?: Record<string, any>
}

// ─── Fire webhook ─────────────────────────────────────────────────────────────

export async function fireWebhook(
  lead: Lead,
  event: WebhookEvent,
  data?: Record<string, any>
): Promise<void> {
  if (!lead.webhook_url) return

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    lead: {
      id:          lead.id ?? '',
      name:        lead.name,
      email:       lead.email,
      phone:       lead.phone,
      niche:       lead.niche,
      city:        lead.city,
      state:       lead.state,
      address:     lead.address,
      website:     lead.website,
      site_url:    lead.cloudflare_url ?? lead.vercel_url ?? '',
      status:      lead.status,
      client_plan: (lead as any).client_plan ?? 'launch',
    },
    data,
  }

  let statusCode: number | undefined
  let error: string | undefined

  try {
    const res = await fetch(lead.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-WebCrew-Event': event },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
    statusCode = res.status
    if (!res.ok) error = `HTTP ${res.status}`
  } catch (e: any) {
    error = e.message
    console.error(`[Webhook] Failed for ${lead.name}: ${error}`)
  }

  // Log delivery attempt
  if (lead.id) {
    try {
      await getPool().query(
        `INSERT INTO webhook_log (lead_id, event, status_code, error) VALUES ($1,$2,$3,$4)`,
        [lead.id, event, statusCode ?? null, error ?? null]
      )
    } catch {
      // Non-critical — don't block pipeline
    }
  }
}

// ─── Convenience: fire on status transition ───────────────────────────────────

const STATUS_TO_EVENT: Record<string, WebhookEvent> = {
  deployed:            'lead.deployed',
  outreach_sent:       'lead.outreach_sent',
  sms_sent:            'lead.sms_sent',
  conversation_active: 'lead.conversation_active',
  meeting_scheduled:   'lead.meeting_scheduled',
  payment_link_sent:   'lead.payment_link_sent',
  paid:                'lead.paid',
}

export async function fireStatusWebhook(lead: Lead, newStatus: string): Promise<void> {
  const event = STATUS_TO_EVENT[newStatus]
  if (event) await fireWebhook(lead, event)
}
