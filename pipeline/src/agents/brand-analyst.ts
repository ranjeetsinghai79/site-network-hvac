import { geminiText, GEMINI_PRO }                              from '../tools/gemini.js'
import { crawlBusinessSite, scrapeSite, type BusinessBrain } from '../tools/firecrawl.js'
import type { Lead, BrandData, AgentResult }                  from '../types.js'
import pg                                                      from 'pg'

const EXTRACTION_PROMPT = `You are a brand intelligence analyst. A business's ENTIRE website content is provided.
Extract comprehensive brand data as JSON. This data builds a hyper-personalized AI-upgraded website for them.

Return ONLY this JSON (no markdown fences, no commentary):
{
  "name": "exact business name",
  "tagline": "their actual slogan or null",
  "phone": "primary phone",
  "email": "business email or null",
  "address": "full address",
  "services": ["service1", "service2"],
  "pricing": [{"name": "package name", "price": "$X or call for quote"}],
  "tone": "professional|friendly|urgent|luxury",
  "unique_selling_points": ["usp1", "usp2"],
  "years_in_business": 0,
  "license": "license number or null",
  "service_areas": ["city1", "city2"],
  "google_rating": "4.8",
  "review_count": "150",
  "team_members": [{"name": "Dr. Smith", "role": "Owner"}],
  "certifications": ["cert1"],
  "colors": {
    "primary": "#hex",
    "secondary": "#hex or null",
    "accent": "#hex or null"
  },
  "testimonials": [{"name": "Customer Name", "text": "exact verbatim quote", "rating": 5}],
  "has_online_booking": false,
  "has_financing": false,
  "emergency_available": false,
  "languages": ["English"],
  "awards": [],
  "pain_points_they_solve": ["problem1"],
  "competitor_advantages": ["why choose them"]
}

Rules: real data only, null for missing, no invented names/prices/quotes.`

export async function runBrandAnalystAgent(
  lead: Lead,
  opts?: { fullCrawl?: boolean }
): Promise<AgentResult<Lead>> {
  console.log(`[BrandAnalyst] Analyzing: ${lead.name}`)

  try {
    // Tier 1: no website — infer from business name + editorial summary + Places context
    if (!lead.website) {
      const context = [
        `Business name: ${lead.name}`,
        `Niche: ${lead.niche}`,
        `City: ${lead.city}, ${lead.state}`,
        lead.editorial_summary ? `Google description: ${lead.editorial_summary}` : '',
        lead.rating            ? `Google rating: ${lead.rating} (${lead.review_count} reviews)` : '',
        (lead.google_reviews as any[])?.length
          ? `Top review: "${(lead.google_reviews as any[])[0]?.text?.slice(0, 200)}"` : '',
      ].filter(Boolean).join('\n')

      const inferPrompt = `Given this local business, infer their likely service offerings. Return ONLY a JSON array of 6 specific service names (no descriptions). Be specific to this business type — "Mini-Split Installation" beats "HVAC Services". Do not fabricate locations or credentials.\n\n${context}`

      let services: string[] = []
      try {
        const raw = await geminiText(inferPrompt)
        const match = raw.match(/\[[\s\S]*?\]/)
        if (match) services = JSON.parse(match[0]).slice(0, 6)
      } catch { /* use fallback in config-generator */ }

      const brandData: BrandData = {
        name:             lead.name,
        phone:            lead.phone,
        address:          lead.address,
        google_rating:    lead.rating?.toString(),
        review_count:     lead.review_count?.toString(),
        service_areas:    lead.city ? [lead.city] : [],
        tagline:          lead.editorial_summary ?? undefined,
        services,
        tone:             'professional',
      }
      console.log(`[BrandAnalyst] ${lead.name} — no website, Places data + ${services.length} inferred services`)
      return { success: true, data: { ...lead, brand_data: brandData, status: 'analyzed' } }
    }

    // Deep-crawl full site → build BusinessBrain (text + media)
    console.log(`[BrandAnalyst] Deep-crawling ${lead.website}`)
    const brain = await crawlBusinessSite(lead.website, {
      name:  lead.name,
      niche: lead.niche,
      city:  lead.city,
      state: lead.state,
      fullCrawl: opts?.fullCrawl,
    })

    // Fallback to single-page scrape if crawl fails
    const content = brain?.full_text ?? await scrapeSite(lead.website)

    if (!content) {
      const brandData: BrandData = {
        name:    lead.name,
        phone:   lead.phone,
        address: lead.address,
        services: [],
      }
      return { success: true, data: { ...lead, brand_data: brandData, status: 'analyzed' } }
    }

    const pagesInfo = brain
      ? `Pages crawled: ${brain.pages_scraped} (${brain.page_titles.slice(0, 3).join(', ')})`
      : 'Single page fallback'
    console.log(`[BrandAnalyst] ${pagesInfo}`)

    if (brain) {
      const m = brain.media
      console.log(`[BrandAnalyst] Media: ${m.images.length} images, ${m.youtube_embeds.length} YouTube, ${m.before_after.length} before/after`)
    }

    // Gemini extraction from full multi-page content
    const text = await geminiText(
      `${EXTRACTION_PROMPT}\n\nBusiness: ${lead.name}\nNiche: ${lead.niche}\n\nFull website:\n${content}`,
      { model: GEMINI_PRO }
    )
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON from Gemini')

    const brandData: BrandData = JSON.parse(jsonMatch[0])

    // Real logo from the crawl itself — never trust Gemini's free-form JSON for
    // a URL, only the direct extraction in firecrawl.ts (fetchBusinessLogo in
    // image-generator.ts downloads this and uploads it as /logo.png so builds
    // never lose/hotlink a client's real logo — see the "redesign" skill).
    if (brain?.media.logo_url) brandData.logo_url = brain.media.logo_url

    // Attach brain metadata for downstream agents
    if (brain) {
      (brandData as any).brain_meta = {
        pages_scraped:  brain.pages_scraped,
        has_pricing:    brain.has_pricing,
        has_team:       brain.has_team,
        has_reviews:    brain.has_reviews,
        has_gallery:    brain.has_gallery,
        has_booking:    brain.has_booking,
        is_luxury:      brain.is_luxury,
        media_summary: {
          images:         brain.media.images.length,
          hero_images:    brain.media.hero_images,
          gallery_images: brain.media.gallery_images.slice(0, 10),
          youtube_embeds: brain.media.youtube_embeds,
          before_after:   brain.media.before_after,
          video_testimonials: brain.media.video_testimonials,
          logo_url:       brain.media.logo_url,
        },
      }
    }

    // Persist brain to DB (non-fatal if fails)
    if (brain && lead.id) {
      await persistBrain(lead.id, brain).catch(e =>
        console.warn('[BrandAnalyst] brain persist failed:', e.message)
      )
    }

    console.log(`[BrandAnalyst] Done: ${brandData.services?.length ?? 0} services, ${brandData.testimonials?.length ?? 0} testimonials`)

    return {
      success: true,
      data: { ...lead, brand_data: brandData, status: 'analyzed' },
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

async function persistBrain(leadId: string, brain: BusinessBrain): Promise<void> {
  if (!process.env.DATABASE_URL) return
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query(
      `UPDATE leads SET business_brain = $1 WHERE id = $2`,
      [JSON.stringify(brain), leadId]
    )
  } finally {
    await pool.end()
  }
}
