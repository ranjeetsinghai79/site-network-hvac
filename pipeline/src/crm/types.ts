import type { Lead } from '../types.js'

export type CrmProvider = 'internal' | 'webhook' | 'twenty' | 'espocrm' | 'odoo' | 'suitecrm'

export interface CrmContact {
  id?: string
  name: string
  email?: string
  phone?: string
  company?: string
  website?: string
  city?: string
  state?: string
  source?: string
  status?: string
  metadata?: Record<string, unknown>
}

export interface CrmDeal {
  id?: string
  contactId?: string
  name: string
  stage: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
  value?: number
  metadata?: Record<string, unknown>
}

export interface CrmAdapter {
  provider: CrmProvider
  upsertContact(contact: CrmContact): Promise<{ externalId?: string }>
  upsertDeal(deal: CrmDeal): Promise<{ externalId?: string }>
}

export function leadToCrmContact(lead: Lead): CrmContact {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.name,
    website: lead.website ?? lead.cloudflare_url ?? lead.vercel_url,
    city: lead.city,
    state: lead.state,
    source: 'ai_growth_os',
    status: lead.status,
    metadata: {
      niche: lead.niche,
      tier: lead.tier,
      siteScore: lead.site_score,
      customDomain: lead.custom_domain,
      receptionConfigId: lead.reception_config_id,
    },
  }
}
