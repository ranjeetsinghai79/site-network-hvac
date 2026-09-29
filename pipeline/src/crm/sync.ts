import pg from 'pg'
import type { Lead } from '../types.js'
import { createCrmAdapter } from './adapters.js'
import type { CrmProvider } from './types.js'
import { leadToCrmContact } from './types.js'

const { Pool } = pg

export async function syncLeadToCrm(params: {
  lead: Lead
  workspaceId?: string
  provider?: CrmProvider
  webhookUrl?: string
}): Promise<{ externalId?: string }> {
  const adapter = createCrmAdapter({ provider: params.provider, webhookUrl: params.webhookUrl })
  const contact = leadToCrmContact(params.lead)

  let externalId: string | undefined
  let status = 'sent'
  let error: string | undefined

  try {
    const result = await adapter.upsertContact(contact)
    externalId = result.externalId
  } catch (e: any) {
    status = 'error'
    error = e.message
  }

  await logCrmEvent({
    workspaceId: params.workspaceId,
    leadId: params.lead.id,
    provider: adapter.provider,
    eventType: 'contact.upsert',
    externalId,
    payload: contact,
    status,
    error,
  })

  if (error) throw new Error(error)
  return { externalId }
}

async function logCrmEvent(input: {
  workspaceId?: string
  leadId?: string
  provider: CrmProvider
  eventType: string
  externalId?: string
  payload: unknown
  status: string
  error?: string
}): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query(
      `INSERT INTO crm_sync_events (
         workspace_id, lead_id, provider, event_type, external_id, payload, status, error
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        input.workspaceId ?? null,
        input.leadId ?? null,
        input.provider,
        input.eventType,
        input.externalId ?? null,
        JSON.stringify(input.payload),
        input.status,
        input.error ?? null,
      ]
    )
  } finally {
    await pool.end()
  }
}
