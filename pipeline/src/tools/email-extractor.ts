/**
 * email-extractor.ts
 *
 * Fetches a business website and extracts:
 *   business_email — generic contact address (info@, hello@, contact@, etc.)
 *   owner_email    — personal address found near owner/founder keywords, or non-generic prefix
 *
 * Uses plain fetch (no browser) — fast, ~1-2s per site.
 * Checks main page + /contact + /about pages.
 */

const EMAIL_RE = /[\w.+\-]{1,64}@[\w\-]{1,63}(?:\.[a-z]{2,})+/gi

const GENERIC_PREFIXES = new Set([
  'info', 'hello', 'contact', 'support', 'admin', 'office', 'sales',
  'mail', 'enquiries', 'enquiry', 'help', 'service', 'services',
  'bookings', 'booking', 'reservations', 'appointments', 'team',
  'reception', 'general', 'media', 'press', 'hr', 'jobs', 'careers',
  'noreply', 'no-reply', 'donotreply',
])

const OWNER_KEYWORDS = /\b(owner|founder|co-?founder|president|ceo|coo|director|principal|partner|proprietor|manager)\b/i

const FETCH_TIMEOUT = 7000

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function cleanEmails(html: string): string[] {
  const raw = html.match(EMAIL_RE) ?? []
  return raw
    .map(e => e.toLowerCase())
    .filter(e => {
      // drop image/asset false positives
      if (/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|ico)$/i.test(e)) return false
      // drop placeholder/example emails
      if (/example\.|yourdomain\.|domain\.com|sentry\.|github\.|sampleemail/i.test(e)) return false
      // must have a real-looking TLD
      if (!/\.[a-z]{2,}$/.test(e)) return false
      return true
    })
}

function findOwnerEmail(html: string): string | undefined {
  // Split into chunks of ~300 chars around owner keywords
  const lowerHtml = html.toLowerCase()
  let match: RegExpExecArray | null
  const ownerRe = /\b(owner|founder|co-?founder|president|ceo|coo|director|principal|partner|proprietor|manager)\b/gi
  while ((match = ownerRe.exec(html)) !== null) {
    const start = Math.max(0, match.index - 200)
    const end   = Math.min(html.length, match.index + 300)
    const chunk = html.slice(start, end)
    const emails = cleanEmails(chunk)
    if (emails.length > 0) return emails[0]
  }
  return undefined
}

export interface ExtractedEmails {
  businessEmail?: string
  ownerEmail?:    string
}

export async function extractEmailsFromWebsite(websiteUrl: string): Promise<ExtractedEmails> {
  // Normalize base URL
  let base: string
  try {
    const u = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`)
    base = `${u.protocol}//${u.host}`
  } catch {
    return {}
  }

  const pagesToCheck = [
    websiteUrl,           // main page (may be a deep URL)
    `${base}/contact`,
    `${base}/contact-us`,
    `${base}/about`,
    `${base}/about-us`,
  ]

  const allEmails = new Set<string>()
  let ownerEmail: string | undefined

  for (const pageUrl of pagesToCheck) {
    try {
      const html = await fetchHtml(pageUrl)
      for (const e of cleanEmails(html)) allEmails.add(e)
      if (!ownerEmail) ownerEmail = findOwnerEmail(html)
    } catch {
      // page fetch failed — skip silently
    }
  }

  const emailList = [...allEmails]

  // Business email: prefer a generic-prefix address
  const businessEmail =
    emailList.find(e => GENERIC_PREFIXES.has(e.split('@')[0])) ??
    emailList[0]

  // Owner email: non-generic found near keyword, else non-generic prefix, else undefined
  if (!ownerEmail) {
    ownerEmail = emailList.find(e => !GENERIC_PREFIXES.has(e.split('@')[0]))
  }

  // Don't emit the same address in both slots
  if (ownerEmail === businessEmail) ownerEmail = undefined

  return {
    businessEmail: businessEmail ?? undefined,
    ownerEmail:    ownerEmail ?? undefined,
  }
}
