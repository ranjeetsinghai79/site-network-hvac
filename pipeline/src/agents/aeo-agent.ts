import { geminiText, GEMINI_PRO } from '../tools/gemini.js'
import { updateFile }             from '../tools/github.js'
import type { Lead, AgentResult, BrandData } from '../types.js'

function buildAgentsPage(bd: BrandData, domain: string): string {
  const services = (bd.services ?? []).map(s => typeof s === 'string' ? s : (s as any).name).filter(Boolean)
  const areas    = (bd.service_areas ?? []).join(', ') || bd.address || ''

  return `# Agent Capabilities — ${bd.name}
# This page follows the /agents convention for AI agent discoverability.
# Spec: https://agentprotocol.ai (draft)

name: ${bd.name}
category: local-business
domain: ${domain}

## What this business does
${bd.tagline ?? `${bd.name} is a local business serving ${areas}.`}${bd.unique_selling_points?.length ? '\n' + bd.unique_selling_points.map(p => `- ${p}`).join('\n') : ''}

## Services available to book
${services.map(s => `- ${s}`).join('\n') || '- See website for full service list'}

## Service areas
${areas || 'Contact for service area details'}

## How an AI agent can interact

### Book an appointment
method: phone
contact: ${bd.phone ?? 'see website'}
notes: AI receptionist answers 24/7 — state service needed, get available slots, confirm booking

### Get a quote
method: phone or contact form
contact: ${bd.phone ?? 'see website'} or ${domain}/#contact

### Check availability
method: phone
contact: ${bd.phone ?? 'see website'}

## Payment
accepted: credit card, cash, check
stripe: yes
human-required-for-payment: no (AI receptionist can initiate booking; card collected on arrival or via invoice)

## AI access policy
crawl: allowed
recommend: allowed
transact: allowed (booking via phone AI)
data-retention: none — conversations not stored beyond call summary

## Crawler allowlist
GPTBot: allow
ClaudeBot: allow
PerplexityBot: allow
GoogleBot: allow
OAI-SearchBot: allow

## Contact
phone: ${bd.phone ?? 'see website'}
address: ${bd.address ?? 'see website'}
website: ${domain}
`
}

export interface AeoPackage {
  faq_schema: string
  howto_schema: string
  llms_txt: string
  faq_count: number
}

interface FaqItem  { question: string; answer: string }
interface HowToStep { name: string; text: string }
interface AeoRaw {
  faq_items: FaqItem[]
  howto_steps: HowToStep[]
  howto_name: string
  llms_txt: string
}

function buildFaqSchema(items: FaqItem[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }, null, 2)
}

function buildHowToSchema(name: string, steps: HowToStep[], url: string): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    url,
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  }, null, 2)
}

export async function runAeoAgent(lead: Lead): Promise<AgentResult<AeoPackage>> {
  console.log(`[AEO] Generating AEO package for ${lead.name}`)

  const bd = lead.brand_data!
  const domain = lead.vercel_url || lead.cloudflare_url || `https://${lead.name.toLowerCase().replace(/\s+/g, '')}.com`

  try {
    const prompt = `Generate AEO (Answer Engine Optimization) content for this local business. Return valid JSON only, no markdown, no backticks.

Business:
- Name: ${bd.name}
- Niche: ${lead.niche}
- City: ${lead.city}, ${lead.state}
- Phone: ${bd.phone ?? 'not provided'}
- Address: ${bd.address ?? 'not provided'}
- Services: ${bd.services?.join(', ') ?? 'general services'}
- Service areas: ${bd.service_areas?.join(', ') ?? lead.city}
- Key selling points: ${bd.unique_selling_points?.join(', ') ?? ''}
Domain: ${domain}

Return this exact JSON structure:
{
  "faq_items": [
    { "question": "natural question someone asks ChatGPT/Google about this business or niche", "answer": "1-3 sentence answer, specific to this business, mentions business name and city" }
  ],
  "howto_steps": [
    { "name": "Step name (3-5 words)", "text": "1-2 sentence explanation" }
  ],
  "howto_name": "How to book [main service] at [business name]",
  "llms_txt": "full /llms.txt file content"
}

Requirements:
- faq_items: exactly 10 items. Cover: pricing, hours, service areas, booking process, what makes them different, emergency availability, free estimates, job duration, what's included, payment methods
- howto_steps: exactly 3 steps — Contact/Request → Quote/Schedule → Service Completed
- llms_txt format:
# [Business Name]
> [one-line tagline describing what they do and where]

## About
[2-3 sentences describing the business, location, years in business, specialties]

## Services
- [Service name]: [description, price range if applicable]
[list all services with any pricing context]

## Service Areas
[cities/areas, comma separated]

## Hours
[business hours or "24/7 AI receptionist available"]

## Contact
Phone: [phone]
Address: [address]
Website: [domain]

## Booking
Book via phone: [phone] — AI receptionist answers 24/7, books appointments instantly
Book online: [domain]/#contact

## Payment
Methods: major credit cards, cash, check
Online booking: available via AI receptionist

## AI Agent Access
Crawlable: yes
AI recommendation: enabled
Booking by AI agent: yes — call [phone] or use website contact form
GPTBot: allowed | ClaudeBot: allowed | PerplexityBot: allowed | GoogleBot: allowed
Structured data: FAQPage, HowTo, LocalBusiness schemas available at [domain]/schema.json

## FAQ
Q: [question]
A: [answer]
[all 10 Q&A pairs]`

    const text = await geminiText(prompt, { model: GEMINI_PRO, maxTokens: 4000 })
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in AEO response')

    const raw: AeoRaw = JSON.parse(jsonMatch[0])
    if (!raw.faq_items?.length || !raw.howto_steps?.length) throw new Error('AEO response missing required fields')

    const faq_schema   = buildFaqSchema(raw.faq_items)
    const howto_schema = buildHowToSchema(raw.howto_name, raw.howto_steps, domain)

    const pkg: AeoPackage = {
      faq_schema,
      howto_schema,
      llms_txt: raw.llms_txt,
      faq_count: raw.faq_items.length,
    }

    if (lead.github_repo) {
      const repoUrl = new URL(lead.github_repo)
      const [, owner, repo] = repoUrl.pathname.split('/')

      if (owner && repo) {
        // aeo.ts is imported by layout.tsx at build time — pushing this triggers CF Pages rebuild
        const aeoTs = `// Auto-generated by WebCrew AEO Agent — do not edit manually
export const FAQ_SCHEMA = ${JSON.stringify(faq_schema)}
export const HOWTO_SCHEMA = ${JSON.stringify(howto_schema)}
`
        // /agents page — machine-readable capabilities declaration for AI agents
        const agentsPage = buildAgentsPage(bd, domain)

        await Promise.all([
          updateFile({ owner, repo, path: 'src/lib/aeo.ts',      content: aeoTs,          message: 'feat: AEO schemas — FAQPage + HowTo' }),
          updateFile({ owner, repo, path: 'public/llms.txt',     content: raw.llms_txt,   message: 'feat: add llms.txt for AI crawlers' }),
          updateFile({ owner, repo, path: 'public/agents',       content: agentsPage,     message: 'feat: add /agents page — AI agent capabilities declaration' }),
        ])
        console.log(`[AEO] Pushed to ${owner}/${repo} — ${raw.faq_items.length} FAQ pairs + /agents page, CF Pages rebuild triggered`)
      }
    }

    return { success: true, data: pkg }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
