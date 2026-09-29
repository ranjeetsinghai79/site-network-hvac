// Sheet rows are NOT column-stable: many rows omit Address, shifting everything after col J left.
// Cols A–J (date … website URL) are reliable; everything after is matched by value shape.
export interface ParsedLead {
  key: string
  dateAdded: string
  addedTs: number | null
  name: string; niche: string; city: string; state: string; phone: string; email: string
  businessEmail: string; ownerEmail: string
  sheetHasWebsite: "yes" | "no" | ""
  websiteUrl: string
  mapsUrl: string
  tier: string
  rating: number | null
  reviews: number | null
  canSms: string
  outreachNote: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAPS = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i

export function normalizeUrl(raw: string): string {
  const s = (raw ?? "").trim()
  if (!s || /^(no|n\/a|none|-)$/i.test(s)) return ""
  if (/^https?:\/\//i.test(s)) return s
  return /^[\w-]+(\.[\w-]+)+/.test(s) ? `https://${s}` : ""
}

export function parseRow(tab: string, c: string[]): ParsedLead | null {
  const name = (c[1] ?? "").trim()
  if (!name) return null
  const tail = c.slice(10).map(x => (x ?? "").trim())

  const ratingIdx = tail.findIndex(x => /^[0-5](\.\d+)?$/.test(x))
  const rating = ratingIdx >= 0 ? Number(tail[ratingIdx]) : null
  const reviewsCell = ratingIdx >= 0 ? tail[ratingIdx + 1] : ""
  const emails = tail.filter(x => EMAIL.test(x))
  const dateAdded = (c[0] ?? "").trim()
  const ts = dateAdded ? Date.parse(dateAdded) : NaN
  const websiteUrl = normalizeUrl(c[9] ?? "")
  const hw = (c[8] ?? "").trim().toLowerCase()
  const phone = (c[6] ?? "").trim()
  const mapsUrl = tail.find(x => MAPS.test(x)) ?? ""

  return {
    // Stable across re-syncs even if rows are inserted above: identity is the business, not the row number.
    key: `${tab}|${mapsUrl || `${name}|${(c[3] ?? "").trim()}|${phone.replace(/\D/g, "")}`}`.toLowerCase(),
    dateAdded,
    addedTs: Number.isNaN(ts) ? null : ts,
    name,
    niche: (c[2] ?? "").trim(), city: (c[3] ?? "").trim(), state: (c[4] ?? "").trim(),
    phone, email: (c[7] ?? "").trim(),
    businessEmail: emails[0] ?? "", ownerEmail: emails[1] ?? "",
    sheetHasWebsite: hw.startsWith("no") ? "no" : hw === "yes" || hw.startsWith("has") ? "yes" : "",
    websiteUrl,
    mapsUrl,
    tier: tail.find(x => /^tier\s?[12]$/i.test(x))?.replace(/\s/g, "").toLowerCase() ?? "",
    rating,
    reviews: reviewsCell && /^\d+$/.test(reviewsCell) ? Number(reviewsCell) : null,
    canSms: [...tail].reverse().find(x => /^(yes|no)$/i.test(x))?.toUpperCase() ?? "",
    outreachNote: tail.find(x => /^(sms-)?sent\b/i.test(x)) ?? "",
  }
}
