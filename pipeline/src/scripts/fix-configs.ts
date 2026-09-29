import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { updateFile } from '../tools/github.js'

const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const model = genai.getGenerativeModel({
  model: 'gemini-2.5-flash',
  // @ts-ignore
  generationConfig: { maxOutputTokens: 8192, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
  systemInstruction: `You are a local business website configurator. Return ONLY valid TypeScript code. No markdown fences. No explanation.`,
})

const SCHEMA = `Generate a TypeScript config file with this exact structure:

import type { Service, Testimonial, TrustBadge } from "./types"

export const BUSINESS = {
  name: "...",
  tagline: "...",
  phone: "...",
  phoneHref: "tel:+1...",
  email: "...",
  address: "...",
  serviceAreas: ["city1", "city2"],
  license: "...",
  since: "...",
  google_rating: "4.9",
  review_count: "200",
  emergency: true,
} as const

export const SERVICES: Service[] = [
  { icon: "thermometer", title: "...", desc: "One sentence.", urgent: false }
]

export const TESTIMONIALS: Testimonial[] = [
  { name: "...", location: "...", text: "...", rating: 5 }
]

export const TRUST_BADGES: string[] = [
  "Licensed & Insured", "Same-Day Service", "5-Star Rated", "24/7 Emergency"
]

Rules:
- icon: thermometer | flame | droplets | zap | shield-check | wrench | star | heart | clock
- phone: (XXX) XXX-XXXX format, phoneHref: tel:+1XXXXXXXXXX
- 4 services, 3 testimonials, 4 trust badges`

const BUSINESSES = [
  {
    repo: 'site-dell-s-heating-air-conditioning',
    data: { name: "Dell's Heating & Air", phone: "(209) 833-1610", city: "Tracy, CA", niche: "HVAC", website: "dellsheatingandair.com" }
  },
  {
    repo: 'site-jazz-heating-air-conditioning-and-plumbi',
    data: { name: "JAZZ Heating, Cooling & Plumbing", phone: "Look up Tracy CA", city: "Tracy, CA", niche: "HVAC + Plumbing", website: "jazzhvacplumbing.com" }
  },
  {
    repo: 'site-manny-s-heating-and-air-conditioning',
    data: { name: "Manny's Heating and Air Conditioning", phone: "Look up Tracy CA", city: "Tracy, CA", niche: "HVAC", website: "mannysheatingandac.com" }
  },
  {
    repo: 'site-virginia-mechanical-heating-air-conditio',
    data: { name: "Virginia Mechanical Heating & Air Conditioning", phone: "(209) 832-2966", city: "Tracy/Stockton, CA", niche: "HVAC", website: "virginiamechanical.com" }
  },
]

async function generateConfig(biz: typeof BUSINESSES[0]) {
  const result = await model.generateContent(
    `${SCHEMA}\n\nBusiness: ${JSON.stringify(biz.data)}`
  )
  return result.response.text()
}

async function main() {
  const owner = process.env.DEPLOY_OWNER || 'pavankumarharati'

  for (const biz of BUSINESSES) {
    console.log(`\nFixing: ${biz.data.name}`)

    let config = ''
    for (let attempt = 1; attempt <= 3; attempt++) {
      config = await generateConfig(biz)
      const valid = ['export const BUSINESS', 'export const SERVICES', 'export const TESTIMONIALS', 'export const TRUST_BADGES']
        .every(k => config.includes(k)) && config.trimEnd().endsWith(']')

      if (valid) {
        console.log(`  Generated (${config.length} chars, attempt ${attempt})`)
        break
      }
      console.log(`  Attempt ${attempt} truncated, retrying...`)
      if (attempt === 3) {
        console.log(`  FAILED after 3 attempts`)
        continue
      }
    }

    if (!config) continue

    const ok = await updateFile({
      owner,
      repo: biz.repo,
      path: 'templates/hvac/src/lib/config.ts',
      content: config,
      message: `fix: regenerate config (was truncated)`,
    })

    console.log(`  Push: ${ok ? 'OK' : 'FAILED'}`)
  }

  console.log('\nDone! Cloudflare will auto-trigger builds on each push.')
}

main().catch(console.error)
