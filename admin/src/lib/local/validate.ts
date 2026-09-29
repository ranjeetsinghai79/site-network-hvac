// "Is this lead's website actually live right now?" — free HTTP check, no paid APIs.
import { db } from "./db"

export type CheckStatus =
  | "live" | "live_blocked" | "ssl_error" | "parked" | "dead" | "down" | "timeout" | "social" | "no_website"

export interface CheckResult {
  status: CheckStatus
  http: number | null
  finalUrl: string | null
  error: string | null
  ms: number
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const SOCIAL = /(^|\.)(facebook|fb|instagram|yelp|linktr\.ee|linktree|business\.site|tiktok|twitter|x|youtube|nextdoor|yellowpages|mapquest)\.(com|me|site|ee)$/i
const PARKED = /(this domain (is|may be) for sale|buy this domain|domain (is )?parked|sedoparking|hugedomains|parkingcrew|godaddy\.com\/forsale|afternic|dan\.com|domain has expired|coming soon.{0,40}(godaddy|namecheap))/i

async function readHead(res: Response, max = 65_536): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ""
  const dec = new TextDecoder()
  let out = ""
  while (out.length < max) {
    const { done, value } = await reader.read()
    if (done) break
    out += dec.decode(value, { stream: true })
  }
  reader.cancel().catch(() => {})
  return out
}

export async function checkWebsite(url: string): Promise<CheckResult> {
  const t0 = Date.now()
  const done = (r: Omit<CheckResult, "ms">): CheckResult => ({ ...r, ms: Date.now() - t0 })
  if (!url) return done({ status: "no_website", http: null, finalUrl: null, error: null })

  let host = ""
  try { host = new URL(url).hostname } catch { return done({ status: "dead", http: null, finalUrl: null, error: "invalid URL" }) }
  if (SOCIAL.test(host)) return done({ status: "social", http: null, finalUrl: url, error: "profile page, not a website" })

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" },
    })
    const finalUrl = res.url
    const body = res.status < 400 ? await readHead(res) : ""
    const http = res.status
    if (http < 400) {
      const finalHost = new URL(finalUrl).hostname
      if (PARKED.test(body) || /(hugedomains|sedo|afternic|dan|dropcatch|snapnames|bodis|sav|uniregistry)\.com$/.test(finalHost))
        return done({ status: "parked", http, finalUrl, error: null })
      return done({ status: "live", http, finalUrl, error: null })
    }
    // Bot walls answer humans-only sites with these — site exists, we just can't read it.
    if ([401, 403, 405, 406, 429, 999].includes(http)) return done({ status: "live_blocked", http, finalUrl, error: `HTTP ${http} (bot protection)` })
    if (http === 404 || http === 410) return done({ status: "dead", http, finalUrl, error: `HTTP ${http}` })
    return done({ status: "down", http, finalUrl, error: `HTTP ${http}` })
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } }
    const code = err.cause?.code ?? ""
    if (err.name === "TimeoutError" || err.name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT")
      return done({ status: "timeout", http: null, finalUrl: null, error: "timed out after 10s" })
    if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code))
      return done({ status: "ssl_error", http: null, finalUrl: null, error: code })
    if (code === "ENOTFOUND" || code === "EAI_AGAIN")
      return done({ status: "dead", http: null, finalUrl: null, error: "domain does not resolve" })
    return done({ status: "dead", http: null, finalUrl: null, error: code || err.message })
  }
}

// ── Background jobs (bulk validate) ──────────────────────────────────────────

export interface Job {
  id: string
  total: number
  done: number
  counts: Record<string, number>
  status: "running" | "done" | "cancelled"
  startedAt: number
  finishedAt?: number
}

const g = globalThis as unknown as { __validateJob?: Job }
const CONCURRENCY = 12

export function currentJob(): Job | null {
  return g.__validateJob ?? null
}

export function cancelJob() {
  if (g.__validateJob?.status === "running") g.__validateJob.status = "cancelled"
}

export function startValidation(ids: number[]): Job {
  if (g.__validateJob?.status === "running") throw new Error("A validation job is already running")
  const job: Job = { id: String(Date.now()), total: ids.length, done: 0, counts: {}, status: "running", startedAt: Date.now() }
  g.__validateJob = job
  const d = db()
  const getUrl = d.prepare("SELECT website_url FROM sheet_leads WHERE id = ?")
  const save = d.prepare(
    `UPDATE sheet_leads SET check_status=?, check_http=?, check_final_url=?, check_error=?, check_ms=?, checked_at=? WHERE id=?`,
  )
  let next = 0
  const worker = async () => {
    while (job.status === "running") {
      const i = next++
      if (i >= ids.length) return
      const row = getUrl.get(ids[i])
      const r = await checkWebsite(String(row?.website_url ?? ""))
      save.run(r.status, r.http, r.finalUrl, r.error, r.ms, Date.now(), ids[i])
      job.counts[r.status] = (job.counts[r.status] ?? 0) + 1
      job.done++
    }
  }
  void Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker)).then(() => {
    if (job.status === "running") job.status = "done"
    job.finishedAt = Date.now()
  })
  return job
}
