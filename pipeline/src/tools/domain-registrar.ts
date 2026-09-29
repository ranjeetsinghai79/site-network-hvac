/**
 * domain-registrar.ts
 *
 * Domain availability check + suggestion + Cloudflare Registrar connection.
 *
 * Flow when client pays and wants a domain:
 *   1. suggestDomains(businessName)          → candidate list
 *   2. checkDomainAvailability(domain)        → available + price
 *   3. Client buys via CF Registrar link      → we provide URL
 *      OR buys anywhere (GoDaddy, Namecheap)
 *   4. addCustomDomainToPages(…)              → already in cloudflare.ts
 *
 * Domain availability uses RDAP (free, ICANN standard):
 *   404 = not registered = available
 *   200 = registered     = taken
 *
 * Cloudflare Registrar API: manage domains ALREADY in CF account.
 * For registering NEW domains we generate the purchase URL (no CF purchase API exists).
 */

const CF_BASE = 'https://api.cloudflare.com/client/v4'

function cfHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

// ─── Domain availability (RDAP) ──────────────────────────────────────────────

export type AvailabilityResult =
  | { available: true;  domain: string; tld: string; estimatedPriceUsd: number; purchaseUrl: string }
  | { available: false; domain: string; registrar?: string; expiresAt?: string }
  | { available: null;  domain: string; error: string }

/** Known CF Registrar prices (at-cost, 2024) */
const CF_PRICES: Record<string, number> = {
  com: 9.15,  net: 10.49, org: 9.93,  io: 32.0,
  co: 25.0,   us: 9.0,    info: 13.0, biz: 12.0,
}

export async function checkDomainAvailability(domain: string): Promise<AvailabilityResult> {
  const clean = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  const tld   = clean.split('.').slice(1).join('.')

  try {
    // RDAP lookup — uses Cloudflare's public RDAP server (fast, reliable)
    const rdapUrl = `https://rdap.cloudflare.com/rdap/v1/domain/${clean}`
    const res = await fetch(rdapUrl, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: 'application/rdap+json' },
    })

    if (res.status === 404) {
      // Not found in RDAP = domain is available
      const price = CF_PRICES[tld] ?? 15
      return {
        available:         true,
        domain:            clean,
        tld,
        estimatedPriceUsd: price,
        purchaseUrl:       `https://www.cloudflare.com/products/registrar/?search=${encodeURIComponent(clean)}`,
      }
    }

    if (res.ok) {
      const data = await res.json() as any
      const registrar  = data.entities?.find((e: any) => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3]
      const expiresAt  = data.events?.find((e: any) => e.eventAction === 'expiration')?.eventDate
      return { available: false, domain: clean, registrar, expiresAt }
    }

    // Any other status — treat as unknown
    return { available: null, domain: clean, error: `RDAP returned ${res.status}` }
  } catch (e: any) {
    return { available: null, domain: clean, error: e.message }
  }
}

// ─── Domain name suggestions from business name ───────────────────────────────

/**
 * Generate 6–10 domain candidates from a business name.
 * Covers: exact, short, with-city, without-spaces, common TLDs.
 */
export function suggestDomains(businessName: string, city?: string): string[] {
  // Sanitize: lowercase, strip legal suffixes, replace non-alpha with space
  const cleaned = businessName
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|pllc|dba)\b\.?/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  const words  = cleaned.split(' ').filter(Boolean)
  const slug   = words.join('')          // "jazzheating"
  const hyphen = words.join('-')         // "jazz-heating"
  const abbrev = words.map(w => w[0]).join('')  // "jh"

  const citySlug = city?.toLowerCase().replace(/[^a-z]/g, '') ?? ''

  const candidates = new Set<string>()

  // Exact + variations
  candidates.add(`${slug}.com`)
  candidates.add(`${hyphen}.com`)
  candidates.add(`get${slug}.com`)

  // With city (local SEO boost)
  if (citySlug && citySlug !== slug) {
    candidates.add(`${slug}${citySlug}.com`)
    candidates.add(`${hyphen}-${citySlug}.com`)
  }

  // Short / modern TLDs
  if (words.length >= 2) {
    candidates.add(`${slug}.co`)
    candidates.add(`${slug}.io`)
    candidates.add(`${slug}.net`)
  }

  // Common patterns
  candidates.add(`${slug}pro.com`)
  candidates.add(`${slug}services.com`)
  if (abbrev.length >= 2 && abbrev.length <= 4) {
    candidates.add(`${abbrev}${citySlug || ''}.com`)
  }

  // Keep max 10, shortest first (shorter = more memorable)
  return Array.from(candidates)
    .filter(d => d.length <= 40)  // skip absurdly long names
    .sort((a, b) => a.length - b.length)
    .slice(0, 10)
}

// ─── Cloudflare Registrar: list & manage domains in CF account ───────────────

export interface CFDomain {
  name:          string
  status:        string
  expires_at?:   string
  auto_renew?:   boolean
}

/** List all domains registered in the CF Registrar account */
export async function listRegistrarDomains(): Promise<CFDomain[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) return []

  try {
    const res = await fetch(
      `${CF_BASE}/accounts/${accountId}/registrar/domains`,
      { headers: cfHeaders() }
    )
    if (!res.ok) return []
    const body = await res.json() as any
    return (body.result ?? []).map((d: any) => ({
      name:       d.name,
      status:     d.status,
      expires_at: d.expires_at,
      auto_renew: d.auto_renew,
    }))
  } catch {
    return []
  }
}

/** Get details for one domain in the CF Registrar */
export async function getRegistrarDomain(domain: string): Promise<CFDomain | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) return null

  try {
    const res = await fetch(
      `${CF_BASE}/accounts/${accountId}/registrar/domains/${domain}`,
      { headers: cfHeaders() }
    )
    if (!res.ok) return null
    const body = await res.json() as any
    const d    = body.result
    return { name: d.name, status: d.status, expires_at: d.expires_at, auto_renew: d.auto_renew }
  } catch {
    return null
  }
}

/**
 * Enable auto-renew on a domain in CF Registrar.
 * Call this after client buys their domain through CF.
 */
export async function setAutoRenew(domain: string, enable = true): Promise<boolean> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) return false

  const res = await fetch(
    `${CF_BASE}/accounts/${accountId}/registrar/domains/${domain}`,
    {
      method: 'PUT',
      headers: cfHeaders(),
      body: JSON.stringify({ auto_renew: enable }),
    }
  )
  return res.ok
}
