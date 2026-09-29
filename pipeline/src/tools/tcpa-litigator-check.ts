/**
 * tcpa-litigator-check.ts — supplementary litigator-list scrub (defense in depth).
 *
 * NOT a substitute for consent. This only reduces odds of texting a known
 * serial TCPA plaintiff within the already-consented pool. The hard legal
 * gate is canTextNow()/loadTextableSet()+consentSetAllows() in sms-consent.ts
 * — always run that first and only call this on numbers that already passed it.
 *
 * Vendor: TCPA Litigator List (tcpalitigatorlist.com), single-number scrub.
 * Docs: https://tcpalitigatorlist.com/api-documentation/
 *
 * Unconfigured (no TCPA_LITIGATOR_API_USERNAME/PASSWORD) → every check passes
 * (listed: false) with a one-time warning; this layer is opt-in extra
 * protection on top of the consent gate, not required for a send to be legal.
 */

const API_USER = process.env.TCPA_LITIGATOR_API_USERNAME
const API_PASS = process.env.TCPA_LITIGATOR_API_PASSWORD
const STRICT   = process.env.TCPA_LITIGATOR_STRICT === 'true'

let warnedUnconfigured = false

export interface LitigatorCheckResult {
  listed: boolean
  source: 'litigator-list' | 'unconfigured' | 'error'
  detail?: string
}

export async function checkLitigatorList(phone: string): Promise<LitigatorCheckResult> {
  if (!API_USER || !API_PASS) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true
      console.warn('[TCPA-Litigator] API creds not set — litigator-list scrub SKIPPED (consent gate is still enforced separately). Set TCPA_LITIGATOR_API_USERNAME/PASSWORD to enable.')
    }
    return { listed: false, source: 'unconfigured' }
  }

  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return { listed: false, source: 'error', detail: 'invalid phone' }

  try {
    const auth = Buffer.from(`${API_USER}:${API_PASS}`).toString('base64')
    const res = await fetch('https://api.tcpalitigatorlist.com/scrub/phone/', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ phone_number: digits, type: 'all' }).toString(),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as any
    const r = data?.results ?? data
    const listed = r?.clean === 0 || r?.is_bad_number === true ||
      (Array.isArray(r?.status_array) && r.status_array.length > 0)
    return { listed, source: 'litigator-list', detail: r?.phone_status }
  } catch (e: any) {
    console.warn(`[TCPA-Litigator] lookup failed for ${digits}: ${e.message}`)
    // Fail open by default (availability > extra safety layer); STRICT mode
    // treats an unknown result as risky and blocks the send instead.
    return { listed: STRICT, source: 'error', detail: e.message }
  }
}
