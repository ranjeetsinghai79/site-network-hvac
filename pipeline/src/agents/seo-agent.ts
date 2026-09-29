import { geminiText, GEMINI_FLASH } from '../tools/gemini.js'
import { updateFile }               from '../tools/github.js'
import type { Lead, AgentResult }   from '../types.js'

export interface SeoPackage {
  sitemap_xml: string
  robots_txt: string
  schema_json: string
  llms_txt: string
  meta_strategy: string
  keywords: string[]
}

// The site the client's visitors (and Google) actually reach: custom domain once
// attached, else the Cloudflare Pages URL. `vercel_url` is a legacy fallback.
function liveBaseUrl(lead: Lead): string | null {
  const raw = lead.custom_domain || lead.cloudflare_url || lead.vercel_url
  if (!raw) return null
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withScheme.replace(/\/+$/, '')
}

// Templates are single-page sites (one page.tsx), so `/` is the only real URL.
// Listing /contact or /services would hand Google 404s.
function buildSitemapXml(baseUrl: string): string {
  const lastmod = new Date().toISOString().slice(0, 10)
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
  </url>
</urlset>
`
}

function buildRobotsTxt(baseUrl: string): string {
  const bots = ['*', 'GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'GoogleBot']
  return `${bots.map(b => `User-agent: ${b}\nAllow: /`).join('\n\n')}\n\nSitemap: ${baseUrl}/sitemap.xml\n`
}

export async function runSeoAgent(lead: Lead): Promise<AgentResult<SeoPackage>> {
  console.log(`[SEO] Generating SEO package for ${lead.name}`)

  const bd = lead.brand_data!
  const liveUrl = liveBaseUrl(lead)
  const domain = liveUrl || `https://${lead.name.toLowerCase().replace(/\s+/g, '')}.com`
  const rating  = bd.google_rating ?? 4.8
  const reviews = bd.review_count ?? 24

  try {
    const text = await geminiText(
      `Generate a complete AI-search-optimized SEO package for this local business. Return valid JSON only, no markdown.

Business: ${JSON.stringify({ name: bd.name, address: bd.address, phone: bd.phone, services: bd.services, areas: bd.service_areas }, null, 2)}
Domain: ${domain}
Niche: ${lead.niche}
City: ${lead.city}, ${lead.state}
Rating: ${rating} (${reviews} reviews)

Return this exact JSON structure:
{
  "schema_json": "JSON string containing @graph with: LocalBusiness (with geo, openingHours, areaServed, priceRange, AggregateRating with ${reviews} reviews at ${rating} stars), FAQPage (5 niche-specific Q&As a customer would ask before hiring — include price ranges, what to expect, how long it takes, why choose local), Service schema for each of the top 3 services, HowTo schema for their most common service process (3-4 steps)",
  "llms_txt": "# {Business Name}\\n\\n> One-sentence description of what the business does and where.\\n\\n## Services\\n- List each service with 1-line description\\n\\n## Service Areas\\n- City, State list\\n\\n## Key Facts\\n- Rating: ${rating}/5 (${reviews} Google reviews)\\n- Phone: {phone}\\n- Address: {address}\\n- Niches served: ${lead.niche}\\n\\n## Contact\\n- Website: ${domain}\\n- Phone: {phone}",
  "meta_strategy": "Title tag and meta description formula optimized for local search intent",
  "keywords": ["15 hyper-local keywords targeting city+niche combinations, including question-based keywords for voice/AI search like 'best {niche} in {city}', 'how much does {niche} cost in {city}', 'emergency {niche} near me {city}'"]
}`,
      { model: GEMINI_FLASH, maxTokens: 4000 }
    )
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const generated = JSON.parse(jsonMatch[0]) as Omit<SeoPackage, 'sitemap_xml' | 'robots_txt'>
    // sitemap + robots are deterministic — no LLM, and never a guessed domain
    const seoPackage: SeoPackage = {
      ...generated,
      sitemap_xml: liveUrl ? buildSitemapXml(liveUrl) : '',
      robots_txt:  liveUrl ? buildRobotsTxt(liveUrl)  : '',
    }

    // Push all SEO + AI-search files to client GitHub repo
    if (lead.github_repo) {
      const repoUrl = new URL(lead.github_repo)
      const [, owner, repo] = repoUrl.pathname.split('/')

      if (owner && repo) {
        if (!liveUrl) console.warn(`[SEO] No live URL for ${lead.name} — skipping sitemap.xml/robots.txt`)
        await Promise.all([
          ...(liveUrl ? [
            updateFile({
              owner, repo,
              path: 'public/sitemap.xml',
              content: seoPackage.sitemap_xml,
              message: 'chore: add SEO sitemap.xml',
            }),
            updateFile({
              owner, repo,
              path: 'public/robots.txt',
              content: seoPackage.robots_txt,
              message: 'chore: add robots.txt with AI crawler allowlist',
            }),
          ] : []),
          updateFile({
            owner, repo,
            path: 'public/schema.json',
            content: seoPackage.schema_json,
            message: 'chore: add rich schema (LocalBusiness, FAQPage, Service, HowTo, AggregateRating)',
          }),
          updateFile({
            owner, repo,
            path: 'public/llms.txt',
            content: seoPackage.llms_txt,
            message: 'chore: add llms.txt for AI search citation (ChatGPT, Perplexity, Claude, Gemini)',
          }),
        ])
        console.log(`[SEO] Files pushed to ${owner}/${repo}`)
      }
    }

    return { success: true, data: seoPackage }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
