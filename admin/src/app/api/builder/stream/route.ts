export const runtime = 'edge'
import { NextRequest } from "next/server"
import { Pool } from "@/lib/pool"

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

const FIRECRAWL_URL = process.env.FIRECRAWL_URL ?? "https://api.firecrawl.dev"
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY ?? ""

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

function stepEvent(id: string, label: string, status: "pending" | "working" | "done" | "error", detail?: string) {
  return sse({ type: "step", id, label, status, detail })
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    mode:          "url" | "new"
    url?:          string
    niche?:        string
    businessName?: string
    city?:         string
    text?:         string
    leadId?:       string
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(chunk: string) {
        controller.enqueue(encoder.encode(chunk))
      }

      try {
        let leadId  = body.leadId ?? null
        let website = body.url    ?? null
        let niche   = body.niche  ?? null

        // ── Workflow A: existing URL via Firecrawl ────────────────────────
        if (body.mode === "url" && body.url) {
          send(stepEvent("scrape", "Scraping website", "working"))
          const scraped = await scrapeWebsite(body.url)
          send(stepEvent("scrape", "Scraping website", "done", `${scraped.pageCount} pages · ${scraped.imageCount} images`))

          send(stepEvent("kb", "Saving knowledge base", "working"))
          await saveKnowledge(body.url, scraped, leadId)
          send(stepEvent("kb", "Saving knowledge base", "done"))

          if (!niche) {
            send(stepEvent("niche", "Detecting niche", "working"))
            niche = detectNiche(scraped.allText)
            send(stepEvent("niche", "Detecting niche", "done", niche ?? "auto"))
          }

          send(stepEvent("lead", "Preparing lead record", "working"))
          leadId = await upsertLeadFromUrl(body.url, scraped, niche ?? "hvac")
          send(stepEvent("lead", "Preparing lead record", "done"))

        // ── Workflow B: new business from text dump ───────────────────────
        } else if (body.mode === "new" && body.businessName) {
          send(stepEvent("parse", "Parsing business information", "working"))
          if (body.text) {
            await saveKnowledgeFromText(body.businessName, body.text)
            if (!niche) niche = detectNiche(body.text)
          }
          if (!niche) niche = detectNiche(body.businessName)
          if (!niche) niche = "hvac"
          send(stepEvent("parse", "Parsing business information", "done", `niche: ${niche}`))

          send(stepEvent("lead", "Creating lead record", "working"))
          leadId = await createLeadFromText({
            name:  body.businessName,
            city:  body.city ?? "",
            niche,
            text:  body.text ?? "",
          })
          send(stepEvent("lead", "Creating lead record", "done"))
        } else {
          throw new Error("Invalid request: provide url or businessName")
        }

        if (!leadId) throw new Error("Failed to create lead")

        // ── Pipeline trigger (cloud mode: calls pipeline API) ─────────────
        const pipelineApiUrl = process.env.PIPELINE_TRIGGER_URL
        if (!pipelineApiUrl) {
          // Lead created in DB — no trigger URL set, will run on next scheduled cycle
          send(sse({ type: "done", previewUrl: null, leadId, message: "Lead queued. Set PIPELINE_TRIGGER_URL to enable one-click builds." }))
          return
        }

        send(stepEvent("brand",  "Triggering AI pipeline",        "working"))
        send(stepEvent("config", "Brand analysis → config gen",   "pending"))
        send(stepEvent("build",  "Image gen → GitHub build",      "pending"))
        send(stepEvent("deploy", "Cloudflare Pages deploy",       "pending"))

        const triggerRes = await fetch(pipelineApiUrl, {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${process.env.PIPELINE_TRIGGER_SECRET ?? ""}`,
          },
          body: JSON.stringify({ leadId, niche }),
        })

        if (!triggerRes.ok) {
          throw new Error(`Pipeline trigger failed: ${triggerRes.status}`)
        }

        // Pipeline runs async on Cloud Run — check back in ~10 min
        send(stepEvent("brand",  "Pipeline started on Cloud Run",   "done"))
        send(stepEvent("config", "Running in background (~10 min)", "working"))
        send(stepEvent("build",  "Will deploy when complete",       "pending"))
        send(stepEvent("deploy", "Check lead status for live URL",  "pending"))
        send(sse({ type: "done", previewUrl: null, leadId, message: "Pipeline started. Site will be live in ~10 minutes — refresh lead to see the URL." }))

      } catch (err: any) {
        send(sse({ type: "error", message: err?.message ?? "Build failed" }))
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

// ── Firecrawl scraping ────────────────────────────────────────────────────────

interface ScrapeResult {
  pageCount:  number
  imageCount: number
  allText:    string
  pages:      Array<{ url: string; markdown: string; metadata?: any }>
  imageUrls:  string[]
  phones:     string[]
  emails:     string[]
}

async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  const crawlRes = await fetch(`${FIRECRAWL_URL}/v1/crawl`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${FIRECRAWL_KEY}`,
    },
    body: JSON.stringify({
      url,
      limit:         20,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: false },
      excludePaths:  ["/blog/*", "/news/*", "/privacy*", "/terms*"],
    }),
  })

  if (!crawlRes.ok) return scrapeSinglePage(url)

  const crawlData = await crawlRes.json() as { id?: string; success?: boolean }
  const jobId = crawlData.id
  if (!jobId) return scrapeSinglePage(url)

  for (let i = 0; i < 30; i++) {
    await delay(2000)
    const statusRes = await fetch(`${FIRECRAWL_URL}/v1/crawl/${jobId}`, {
      headers: { "Authorization": `Bearer ${FIRECRAWL_KEY}` },
    })
    const statusData = await statusRes.json() as { status?: string; data?: any[] }
    if (statusData.status === "completed" && statusData.data) {
      return extractResults(statusData.data)
    }
    if (statusData.status === "failed") break
  }

  return scrapeSinglePage(url)
}

async function scrapeSinglePage(url: string): Promise<ScrapeResult> {
  const res = await fetch(`${FIRECRAWL_URL}/v1/scrape`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${FIRECRAWL_KEY}`,
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  })
  if (!res.ok) {
    return { pageCount: 0, imageCount: 0, allText: "", pages: [], imageUrls: [], phones: [], emails: [] }
  }
  const d = await res.json() as { data?: { markdown?: string; metadata?: any } }
  const markdown = d.data?.markdown ?? ""
  return extractResults([{ url, markdown, metadata: d.data?.metadata ?? {} }])
}

function extractResults(pages: any[]): ScrapeResult {
  const allText = pages.map(p => p.markdown ?? "").join("\n\n")
  const phones  = [...new Set(Array.from(allText.matchAll(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g), m => m[0]))]
  const emails  = [...new Set(Array.from(allText.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g), m => m[0]))]
  const imgUrls = [...new Set(Array.from(allText.matchAll(/https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp|gif|svg)/gi), m => m[0]))]

  return {
    pageCount:  pages.length,
    imageCount: imgUrls.length,
    allText,
    pages:      pages.map(p => ({ url: p.url ?? "", markdown: p.markdown ?? "", metadata: p.metadata })),
    imageUrls:  imgUrls,
    phones,
    emails,
  }
}

// ── Knowledge base ────────────────────────────────────────────────────────────

async function saveKnowledge(websiteUrl: string, scraped: ScrapeResult, leadId: string | null) {
  await pool().query(`
    INSERT INTO business_knowledge (
      lead_id, website_url, raw_pages, sitemap_urls, page_count,
      image_urls, phone_numbers, email_addresses, homepage_text
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (website_url) DO UPDATE SET
      lead_id         = COALESCE($1, business_knowledge.lead_id),
      raw_pages       = $3,
      sitemap_urls    = $4,
      page_count      = $5,
      image_urls      = $6,
      phone_numbers   = $7,
      email_addresses = $8,
      homepage_text   = $9,
      scraped_at      = now()
  `, [
    leadId,
    websiteUrl,
    JSON.stringify(scraped.pages),
    JSON.stringify(scraped.pages.map(p => p.url)),
    scraped.pageCount,
    JSON.stringify(scraped.imageUrls),
    JSON.stringify(scraped.phones),
    JSON.stringify(scraped.emails),
    scraped.pages[0]?.markdown?.slice(0, 8000) ?? "",
  ])
}

async function saveKnowledgeFromText(name: string, text: string) {
  const phones = [...new Set(Array.from(text.matchAll(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g), m => m[0]))]
  const emails = [...new Set(Array.from(text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g), m => m[0]))]
  await pool().query(`
    INSERT INTO business_knowledge (website_url, homepage_text, phone_numbers, email_addresses)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (website_url) DO UPDATE SET homepage_text=$2, phone_numbers=$3, email_addresses=$4, scraped_at=now()
  `, [`manual:${name.toLowerCase().replace(/\s+/g, "-")}`, text.slice(0, 8000), JSON.stringify(phones), JSON.stringify(emails)])
}

// ── Lead upsert ───────────────────────────────────────────────────────────────

async function upsertLeadFromUrl(url: string, scraped: ScrapeResult, niche: string): Promise<string> {
  const domain  = new URL(url).hostname.replace(/^www\./, "")
  const bizName = domain.split(".")[0].replace(/-/g, " ")
  const phone   = scraped.phones[0]
  const email   = scraped.emails[0]
  const placeId = `manual:${domain}`

  const { rows } = await pool().query(`
    INSERT INTO leads (place_id, name, phone, email, website, niche, status, tier)
    VALUES ($1,$2,$3,$4,$5,$6,'found','tier2')
    ON CONFLICT (place_id) DO UPDATE SET
      name  = COALESCE(EXCLUDED.name, leads.name),
      phone = COALESCE(EXCLUDED.phone, leads.phone),
      email = COALESCE(EXCLUDED.email, leads.email),
      niche = EXCLUDED.niche
    RETURNING id
  `, [placeId, bizName, phone ?? null, email ?? null, url, niche])

  const leadId = rows[0].id
  await pool().query(`UPDATE business_knowledge SET lead_id=$1 WHERE website_url=$2`, [leadId, url])
  return leadId
}

async function createLeadFromText({ name, city, niche, text }: { name: string; city: string; niche: string; text: string }): Promise<string> {
  const placeId = `manual:${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`
  const phones  = Array.from(text.matchAll(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g), m => m[0])
  const emails  = Array.from(text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g), m => m[0])

  const { rows } = await pool().query(`
    INSERT INTO leads (place_id, name, phone, email, city, niche, status, tier)
    VALUES ($1,$2,$3,$4,$5,$6,'found','tier1')
    RETURNING id
  `, [placeId, name, phones[0] ?? null, emails[0] ?? null, city, niche])

  return rows[0].id
}

// ── Niche detection ───────────────────────────────────────────────────────────

function detectNiche(text: string): string | null {
  const lower = text.toLowerCase()
  const map: [string, string][] = [
    ["hvac",           "hvac|heating|cooling|air condition"],
    ["roofing",        "roof|shingle|gutter"],
    ["dentist",        "dent|teeth|orthodon|smile"],
    ["medspa",         "medspa|med spa|botox|filler|facial|laser"],
    ["lawfirm",        "attorney|lawyer|legal|law firm"],
    ["cleaning",       "clean|maid|janitorial"],
    ["junk-removal",   "junk|removal|haul"],
    ["daycare",        "daycare|childcare|preschool|toddler"],
    ["auto-detailing", "detail|car wash|auto"],
    ["restaurant",     "restaurant|food|dining|menu|cuisine"],
    ["plumbing",       "plumb|pipe|drain|water heater"],
    ["landscaping",    "landscap|lawn|garden|mow"],
    ["remodeling",     "remodel|renovation|kitchen|bathroom"],
    ["salon",          "salon|hair|cut|style|color"],
    ["barbershop",     "barber|fade|trim|beard"],
  ]
  for (const [niche, pattern] of map) {
    if (new RegExp(pattern).test(lower)) return niche
  }
  return null
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }
