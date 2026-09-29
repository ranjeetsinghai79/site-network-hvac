/**
 * Apollo.io API — owner name + direct email enrichment
 * Free: 10,000 export credits/month
 * Signup: https://app.apollo.io → Settings → API Keys
 * Env: APOLLO_API_KEY
 *
 * Given a business name + city OR domain → returns owner/decision maker contact
 */
import type { EnrichResult } from './types.js'

const BASE = 'https://api.apollo.io/v1'

interface ApolloContact {
  first_name?: string
  last_name?:  string
  name?:       string
  title?:      string
  email?:      string
  phone_numbers?: Array<{ sanitized_number: string; type: string }>
  organization?: { name: string; website_url?: string }
}

interface ApolloSearchResponse {
  contacts?: ApolloContact[]
  people?:   ApolloContact[]  // older API shape
  pagination?: { total_entries: number }
}

const OWNER_TITLES = [
  'owner','founder','co-founder','president','ceo','principal',
  'managing partner','partner','director','proprietor',
]

function isOwnerTitle(title?: string): boolean {
  if (!title) return false
  const t = title.toLowerCase()
  return OWNER_TITLES.some(o => t.includes(o))
}

async function apolloPost(path: string, body: object): Promise<any> {
  const key = process.env.APOLLO_API_KEY
  if (!key) throw new Error('APOLLO_API_KEY not set — sign up free at apollo.io')

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  if (res.status === 422) return null  // no results
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Apollo ${res.status}: ${err.slice(0,200)}`)
  }
  return res.json()
}

/** Find owner/decision-maker by company domain */
export async function enrichByDomain(domain: string): Promise<EnrichResult | null> {
  // Strip protocol/path
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')

  const data: ApolloSearchResponse | null = await apolloPost('/mixed_people/search', {
    q_organization_domains: cleanDomain,
    person_titles: OWNER_TITLES,
    page: 1,
    per_page: 5,
  }).catch(() => null)

  if (!data) return null
  const contacts = data.contacts ?? data.people ?? []
  if (!contacts.length) return null

  // Prefer owner-titled contacts
  const owner = contacts.find(c => isOwnerTitle(c.title)) ?? contacts[0]

  return {
    ownerName:  [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.name,
    ownerEmail: owner.email,
    ownerPhone: owner.phone_numbers?.[0]?.sanitized_number,
    ownerTitle: owner.title,
    source: 'apollo',
  }
}

/** Find owner by company name + city (no domain needed) */
export async function enrichByCompanyName(name: string, city: string, state: string): Promise<EnrichResult | null> {
  // First find the organization
  const orgData = await apolloPost('/mixed_companies/search', {
    q_organization_name: name,
    organization_locations: [`${city}, ${state}`],
    page: 1,
    per_page: 3,
  }).catch(() => null)

  const orgId = orgData?.organizations?.[0]?.id
  if (!orgId) return null

  // Then find contacts in that org
  const contactData: ApolloSearchResponse | null = await apolloPost('/mixed_people/search', {
    organization_ids: [orgId],
    person_titles: OWNER_TITLES,
    page: 1,
    per_page: 5,
  }).catch(() => null)

  const contacts = contactData?.contacts ?? contactData?.people ?? []
  if (!contacts.length) return null

  const owner = contacts.find(c => isOwnerTitle(c.title)) ?? contacts[0]

  return {
    ownerName:  [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.name,
    ownerEmail: owner.email,
    ownerPhone: owner.phone_numbers?.[0]?.sanitized_number,
    ownerTitle: owner.title,
    source: 'apollo',
  }
}

/** Batch enrich a list of domains (most efficient — 1 API call per domain) */
export async function enrichDomainsBatch(
  items: Array<{ domain: string; meta: Record<string, any> }>,
  concurrency = 5
): Promise<Array<{ meta: Record<string, any>; result: EnrichResult | null }>> {
  const out: Array<{ meta: Record<string, any>; result: EnrichResult | null }> = []
  let next = 0

  async function worker() {
    while (next < items.length) {
      const idx = next++
      const { domain, meta } = items[idx]
      await new Promise(r => setTimeout(r, 200)) // 200ms between calls
      const result = await enrichByDomain(domain).catch(() => null)
      out[idx] = { meta, result }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}
