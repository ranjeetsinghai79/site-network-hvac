import type { CrmAdapter, CrmContact, CrmDeal, CrmProvider } from './types.js'

export class InternalCrmAdapter implements CrmAdapter {
  provider: CrmProvider = 'internal'

  async upsertContact(contact: CrmContact): Promise<{ externalId?: string }> {
    return { externalId: contact.id }
  }

  async upsertDeal(deal: CrmDeal): Promise<{ externalId?: string }> {
    return { externalId: deal.id }
  }
}

export class WebhookCrmAdapter implements CrmAdapter {
  provider: CrmProvider = 'webhook'

  constructor(private readonly webhookUrl: string) {}

  async upsertContact(contact: CrmContact): Promise<{ externalId?: string }> {
    return this.post('contact.upsert', contact)
  }

  async upsertDeal(deal: CrmDeal): Promise<{ externalId?: string }> {
    return this.post('deal.upsert', deal)
  }

  private async post(event: string, payload: unknown): Promise<{ externalId?: string }> {
    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-Growth-Event': event },
      body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`CRM webhook failed: HTTP ${res.status}`)
    const json = await res.json().catch(() => ({})) as { externalId?: string }
    return { externalId: json.externalId }
  }
}

export function createCrmAdapter(params?: { provider?: CrmProvider; webhookUrl?: string }): CrmAdapter {
  if (params?.provider === 'webhook' && params.webhookUrl) return new WebhookCrmAdapter(params.webhookUrl)
  return new InternalCrmAdapter()
}
