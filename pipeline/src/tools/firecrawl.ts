/**
 * firecrawl.ts — Business Brain extractor
 *
 * The BusinessBrain is the persistent LLM context for each business.
 * It powers: audit, blog generation, AI reception knowledge base,
 * website upgrades, AI growth activities, competitive analysis.
 *
 * Media extraction: images, hero photos, before/after galleries,
 * video testimonials, YouTube/Vimeo embeds — used to upgrade existing sites
 * into luxury builds with real client media.
 */

export async function scrapeSite(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.FIRECRAWL_URL}/v1/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY ?? 'local'}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    })
    const data = await res.json() as any
    return data.data?.markdown || data.data?.content || null
  } catch {
    return null
  }
}

export interface BusinessMedia {
  images:           string[]   // all image URLs found across the site
  hero_images:      string[]   // og:image, first large images above fold
  gallery_images:   string[]   // portfolio/gallery/work images
  before_after:     Array<{ before: string; after: string; caption?: string }>
  logo_url:         string | null
  videos:           string[]   // direct video file URLs
  youtube_embeds:   string[]   // YouTube video IDs
  vimeo_embeds:     string[]   // Vimeo video IDs
  video_testimonials: string[] // videos tagged as testimonials/reviews
  og_image:         string | null
}

export interface BusinessBrain {
  // Identity
  url:            string
  name:           string
  niche:          string
  city:           string
  state:          string

  // Content brain — powers AI reception, blog generation, config gen
  full_text:      string       // all pages combined (up to 20k chars)
  services:       string[]
  pricing_text:   string       // raw pricing section text
  team_text:      string       // team/about section text
  faq_text:       string       // FAQ section text
  testimonial_text: string     // review/testimonial section text
  service_areas:  string[]

  // Signals
  has_pricing:    boolean
  has_team:       boolean
  has_reviews:    boolean
  has_gallery:    boolean
  has_booking:    boolean
  has_financing:  boolean
  has_chat:       boolean
  is_luxury:      boolean      // luxury/premium signals in copy

  // Media brain — used to upgrade existing sites with real client media
  media:          BusinessMedia

  // Crawl metadata
  pages_scraped:  number
  page_titles:    string[]
  crawled_at:     string
}

/**
 * Deep-crawl entire business website.
 * Extracts text + media for the per-business LLM brain.
 * Used by: brand-analyst, audit-report, blog-generator, ai-reception, growth agents.
 */
export async function crawlBusinessSite(
  url: string,
  opts?: { name?: string; niche?: string; city?: string; state?: string; fullCrawl?: boolean }
): Promise<BusinessBrain | null> {
  const base    = process.env.FIRECRAWL_URL
  const apiKey  = process.env.FIRECRAWL_API_KEY ?? 'local'

  if (!base) return null

  // fullCrawl (used by the "redesign" skill): a client-paid redesign needs every
  // page/testimonial/photo, not the lightweight lead-scoring snapshot every other
  // caller (brand-analyst's tier1/2 branch, audit-report, blog-generator) wants —
  // those stay on the cheap 15-page/no-blog default to protect Firecrawl's shared
  // free-tier quota (500 scrapes/month, see CLAUDE.md). Blog/testimonial pages are
  // excluded by default because they're rarely load-bearing for a quick lead brand
  // snapshot and are the most likely place to blow the page budget on a large site.
  try {
    const startRes = await fetch(`${base}/v1/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        url,
        limit: opts?.fullCrawl ? 50 : 15,
        scrapeOptions: {
          formats: ['markdown', 'html', 'links'],
          onlyMainContent: false,   // need full HTML for media extraction
          includeTags: ['img', 'video', 'iframe', 'source', 'picture'],
        },
        excludePaths: opts?.fullCrawl
          ? ['/privacy*', '/terms*', '/sitemap*']
          : ['/blog/*', '/news/*', '/careers/*', '/jobs/*', '/privacy*', '/terms*', '/sitemap*'],
      }),
    })

    const startData = await startRes.json() as any

    // Self-hosted or direct response
    if (startData.data && Array.isArray(startData.data)) {
      return buildBrain(url, startData.data, opts)
    }

    const jobId = startData.id
    if (!jobId) {
      // Single-page fallback
      const text = await scrapeSite(url)
      if (!text) return null
      return singlePageBrain(url, text, opts)
    }

    // Poll for completion (max 60s — 12 × 5s)
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const poll = await fetch(`${base}/v1/crawl/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const pollData = await poll.json() as any

      if (pollData.status === 'completed' && Array.isArray(pollData.data)) {
        return buildBrain(url, pollData.data, opts)
      }
      if (pollData.status === 'failed') break

      // Use partial results at 30s mark
      if (i === 6 && Array.isArray(pollData.data) && pollData.data.length > 0) {
        return buildBrain(url, pollData.data, opts)
      }
    }

    // Timed out — single-page fallback
    const text = await scrapeSite(url)
    if (!text) return null
    return singlePageBrain(url, text, opts)

  } catch {
    return null
  }
}

// ─── Brain builders ────────────────────────────────────────────────────────────

function singlePageBrain(
  url: string,
  text: string,
  opts?: { name?: string; niche?: string; city?: string; state?: string; fullCrawl?: boolean }
): BusinessBrain {
  return buildBrain(url, [{ markdown: text, html: '', links: [], metadata: { sourceURL: url } }], opts)
}

function buildBrain(
  url: string,
  pages: any[],
  opts?: { name?: string; niche?: string; city?: string; state?: string; fullCrawl?: boolean }
): BusinessBrain {
  let combined   = ''
  const titles: string[] = []
  const allHtml: string[] = []
  const allLinks: string[] = []

  for (const page of pages) {
    const md    = page.markdown || page.content || ''
    const html  = page.html || ''
    const links = Array.isArray(page.links) ? page.links : []
    const title = page.metadata?.title || page.metadata?.sourceURL || ''

    if (md.trim()) {
      titles.push(title)
      combined += `\n\n--- PAGE: ${title} ---\n${md}`
    }
    if (html) allHtml.push(html)
    allLinks.push(...links)
  }

  const full = combined.slice(0, opts?.fullCrawl ? 60000 : 20000)
  const htmlAll = allHtml.join('\n')

  // Extract first page og:image
  const ogImage = pages[0]?.metadata?.ogImage || pages[0]?.metadata?.['og:image'] || extractOgImage(htmlAll) || null

  // Extract all media
  const media = extractMedia(htmlAll, allLinks, pages, ogImage)

  // Section detection
  const pricingMatch = full.match(/(?:price|pricing|cost|package|rate)[\s\S]{0,2000}/i)
  const teamMatch    = full.match(/(?:our team|meet.*team|staff|about us|who we are)[\s\S]{0,1500}/i)
  const faqMatch     = full.match(/(?:FAQ|frequently asked|common questions)[\s\S]{0,2000}/i)
  const testimMatch  = full.match(/(?:testimonial|review|what.*say|client.*say)[\s\S]{0,2000}/i)

  // Service area extraction
  const areaMatches = full.match(/serving\s+([A-Z][a-z]+(?:,?\s+[A-Z][a-z]+)*)/g) || []
  const serviceAreas = areaMatches.flatMap(m => m.replace(/^serving\s+/, '').split(/,\s*/)).slice(0, 10)

  // Service list extraction (simple keyword list near "services" heading)
  const serviceMatch = full.match(/(?:services|what we do|what we offer)[\s\S]{0,1000}/i)
  const services = serviceMatch
    ? [...serviceMatch[0].matchAll(/^\s*[-•*]\s*(.+)/gm)].map(m => m[1].trim()).slice(0, 10)
    : []

  return {
    url,
    name:  opts?.name  ?? pages[0]?.metadata?.title ?? '',
    niche: opts?.niche ?? '',
    city:  opts?.city  ?? '',
    state: opts?.state ?? '',

    full_text:         full,
    services,
    pricing_text:      pricingMatch?.[0]?.slice(0, 1000) ?? '',
    team_text:         teamMatch?.[0]?.slice(0, 1000)    ?? '',
    faq_text:          faqMatch?.[0]?.slice(0, 1000)     ?? '',
    testimonial_text:  testimMatch?.[0]?.slice(0, 1000)  ?? '',
    service_areas:     serviceAreas,

    has_pricing:   /price|pricing|cost|package|\$\d/i.test(full),
    has_team:      /our team|meet.*team|staff|specialist|doctor|dr\./i.test(full),
    has_reviews:   /review|testimonial|five star|5 star|★/i.test(full),
    has_gallery:   /gallery|portfolio|our work|before.*after/i.test(full),
    has_booking:   /book|schedule|appointment|calendar|reserve/i.test(full),
    has_financing: /financing|payment plan|0%|no interest|affirm|care credit/i.test(full),
    has_chat:      /live chat|chat with|chat now|intercom|tidio|drift/i.test(full),
    is_luxury:     /luxury|premium|elite|exclusive|bespoke|high-end|world-class/i.test(full),

    media,

    pages_scraped: pages.filter(p => p.markdown || p.content).length,
    page_titles:   titles.slice(0, 10),
    crawled_at:    new Date().toISOString(),
  }
}

function extractMedia(html: string, links: string[], pages: any[], ogImage: string | null): BusinessMedia {
  const allImages: string[]        = []
  const heroImages: string[]       = []
  const galleryImages: string[]    = []
  const beforeAfter: Array<{ before: string; after: string; caption?: string }> = []
  const videos: string[]           = []
  const youtubeIds: string[]       = []
  const vimeoIds: string[]         = []
  const videoTestimonials: string[] = []
  let logoUrl: string | null       = null

  // ─── Images from HTML ────────────────────────────────────────────────
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi
  let imgMatch: RegExpExecArray | null
  while ((imgMatch = imgTagRegex.exec(html)) !== null) {
    const src = imgMatch[1]
    const alt = (imgMatch[2] || '').toLowerCase()
    if (!src || src.startsWith('data:') || /\.(svg|ico|gif)$/i.test(src)) continue

    const absUrl = toAbsolute(src)
    if (!absUrl) continue

    allImages.push(absUrl)

    if (/logo/i.test(alt) || /logo/i.test(src)) {
      logoUrl = logoUrl ?? absUrl
    } else if (/before/i.test(alt) || /before/i.test(src)) {
      // Try to pair with after image
      const afterSrc = src.replace(/before/gi, 'after')
      beforeAfter.push({ before: absUrl, after: toAbsolute(afterSrc) ?? absUrl, caption: alt })
    } else if (/after/i.test(alt) || /after/i.test(src)) {
      // Already handled in before branch if paired
    } else if (/gallery|portfolio|work|project|result/i.test(alt + src)) {
      galleryImages.push(absUrl)
    } else if (allImages.indexOf(absUrl) === 0 || /hero|banner|background|main/i.test(alt + src)) {
      heroImages.push(absUrl)
    }
  }

  // og:image as primary hero
  if (ogImage && !heroImages.includes(ogImage)) heroImages.unshift(ogImage)

  // ─── Logo from link tags ──────────────────────────────────────────────
  if (!logoUrl) {
    const linkIconMatch = html.match(/<link[^>]+rel=["'](?:icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i)
    if (linkIconMatch) logoUrl = toAbsolute(linkIconMatch[1])
  }

  // ─── Videos ──────────────────────────────────────────────────────────
  // Direct video tags
  const videoSrcRegex = /<(?:video|source)[^>]+src=["']([^"']+)["'][^>]*>/gi
  let vMatch: RegExpExecArray | null
  while ((vMatch = videoSrcRegex.exec(html)) !== null) {
    const src = toAbsolute(vMatch[1])
    if (src && /\.(mp4|webm|mov|avi)/i.test(src)) videos.push(src)
  }

  // YouTube iframes
  const ytRegex = /(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/g
  let ytMatch: RegExpExecArray | null
  while ((ytMatch = ytRegex.exec(html)) !== null) {
    if (!youtubeIds.includes(ytMatch[1])) youtubeIds.push(ytMatch[1])
  }

  // Vimeo iframes
  const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/g
  let vimeoMatch: RegExpExecArray | null
  while ((vimeoMatch = vimeoRegex.exec(html)) !== null) {
    if (!vimeoIds.includes(vimeoMatch[1])) vimeoIds.push(vimeoMatch[1])
  }

  // Tag some YouTube embeds as video testimonials if near "review" / "testimonial" context
  const testimonialCtx = html.match(/(?:testimonial|review|client|customer)[\s\S]{0,500}(?:youtube|vimeo)/gi) || []
  for (const ctx of testimonialCtx) {
    const ytInCtx = ctx.match(/([a-zA-Z0-9_-]{11})/)?.[1]
    if (ytInCtx && youtubeIds.includes(ytInCtx)) videoTestimonials.push(`https://youtube.com/watch?v=${ytInCtx}`)
  }

  // ─── Gallery images from known URL patterns ───────────────────────────
  for (const link of links) {
    if (typeof link !== 'string') continue
    if (/gallery|portfolio|work|project|result|photo/i.test(link) && /\.(jpg|jpeg|png|webp)/i.test(link)) {
      const abs = toAbsolute(link)
      if (abs && !galleryImages.includes(abs)) galleryImages.push(abs)
    }
  }

  return {
    images:             [...new Set(allImages)].slice(0, 50),
    hero_images:        [...new Set(heroImages)].slice(0, 5),
    gallery_images:     [...new Set(galleryImages)].slice(0, 30),
    before_after:       beforeAfter.slice(0, 10),
    logo_url:           logoUrl,
    videos:             [...new Set(videos)].slice(0, 10),
    youtube_embeds:     [...new Set(youtubeIds)].slice(0, 10),
    vimeo_embeds:       [...new Set(vimeoIds)].slice(0, 10),
    video_testimonials: [...new Set(videoTestimonials)].slice(0, 5),
    og_image:           ogImage,
  }
}

function extractOgImage(html: string): string | null {
  const m = html.match(/<meta[^>]+(?:property=["']og:image["']|name=["']og:image["'])[^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  return m?.[1] ?? null
}

function toAbsolute(src: string): string | null {
  if (!src) return null
  if (src.startsWith('http')) return src
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('/')) return null  // can't resolve without base URL in all cases
  return null
}
