import { geminiText, GEMINI_PRO } from '../tools/gemini.js'
import type { BusinessBrain }    from './types.js'

const FIRECRAWL_URL = process.env.FIRECRAWL_URL ?? 'https://api.firecrawl.dev'
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY ?? ''

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function buildBrain(websiteUrl: string): Promise<BusinessBrain> {
  console.log(`[Brain] Scraping ${websiteUrl}...`)
  const { content, heroImage } = await scrapeWebsite(websiteUrl)
  console.log(`[Brain] Scraped ${content.length} chars — extracting...`)
  const brain = await extractBrainData(content, websiteUrl)
  if (heroImage) brain.heroImage = heroImage
  console.log(`[Brain] Done: ${brain.name} | ${brain.services.length} services | ${brain.faqs.length} FAQs`)
  return brain
}

// ─── Hero image: pulled from the same html Firecrawl already fetched — no extra scrape ──

function extractHeroImage(html: string | undefined, baseUrl: string): string | undefined {
  if (!html) return undefined
  const ogMatch = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i)
  const raw = ogMatch?.[1] ?? html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]
  if (!raw) return undefined
  try { return new URL(raw, baseUrl).toString() } catch { return undefined }
}

// ─── Firecrawl: crawl up to 10 pages, fallback to single scrape ───────────────

async function scrapeWebsite(url: string): Promise<{ content: string; heroImage?: string }> {
  try {
    // Try crawl first (multiple pages = more complete brain)
    const crawlRes = await fetch(`${FIRECRAWL_URL}/v1/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, limit: 10, scrapeOptions: { formats: ['markdown', 'html'] } }),
    })
    if (!crawlRes.ok) throw new Error(`crawl ${crawlRes.status}`)

    const { id: jobId } = await crawlRes.json() as any

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const poll = await fetch(`${FIRECRAWL_URL}/v1/crawl/${jobId}`, {
        headers: { 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
      })
      const pollData = await poll.json() as any
      if (pollData.status === 'completed') {
        const pages = pollData.data ?? []
        const content = pages.map((p: any) => p.markdown ?? '').join('\n\n---\n\n').slice(0, 60000)
        // First crawled page is typically the entry URL itself — best hero-image candidate.
        const heroImage = extractHeroImage(pages[0]?.html, url)
        return { content, heroImage }
      }
    }
    throw new Error('crawl timeout')
  } catch (e: any) {
    console.log(`[Brain] Crawl failed (${e.message}), using single-page scrape`)
    const res = await fetch(`${FIRECRAWL_URL}/v1/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, formats: ['markdown', 'html'] }),
    })
    const data = await res.json() as any
    return { content: data.data?.markdown ?? '', heroImage: extractHeroImage(data.data?.html, url) }
  }
}

// ─── Gemini: extract structured business data ─────────────────────────────────

async function extractBrainData(content: string, url: string): Promise<BusinessBrain> {

  const prompt = `Extract all business information from this website content. Return ONLY valid JSON.

Website: ${url}

Content:
${content.slice(0, 40000)}

Return this exact JSON structure (use null for missing fields):
{
  "name": "Business Name",
  "type": "business type (e.g. hvac, dentist, restaurant)",
  "address": "full street address",
  "phone": "main phone number",
  "email": "contact email",
  "hours": {
    "monday": "9am-5pm",
    "tuesday": "9am-5pm",
    "wednesday": "9am-5pm",
    "thursday": "9am-5pm",
    "friday": "9am-5pm",
    "saturday": "closed",
    "sunday": "closed"
  },
  "services": [
    {
      "name": "Service name",
      "price": "$X or null",
      "duration": "1 hour or null",
      "description": "brief one-line description"
    }
  ],
  "booking_url": "full URL to book online or null",
  "booking_instructions": "how to book — online form, call us, walk-in, etc.",
  "faqs": [
    { "question": "Common question?", "answer": "Concise answer." }
  ],
  "special_notes": "insurance accepted, certifications, guarantees, policies",
  "owner_phone": "direct owner/manager cell if found, else null"
}

Rules:
- Extract actual hours shown on site, not guesses
- Include all services with pricing if listed
- Generate up to 10 FAQs from page content (pricing, hours, booking, cancellation, service area, etc.)
- owner_phone: only set if clearly a direct/cell number, not the main business number`

  const text = (await geminiText(prompt, { model: GEMINI_PRO })).trim()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini returned no JSON')

  const brain = JSON.parse(jsonMatch[0]) as BusinessBrain

  // Normalize
  if (!brain.hours) brain.hours = {}
  if (!brain.services) brain.services = []
  if (!brain.faqs) brain.faqs = []

  return brain
}

// ─── Build system prompt from brain ──────────────────────────────────────────

function isHvacBusiness(type: string): boolean {
  return /hvac|heating|cooling|air condition|furnace/i.test(type)
}

const HVAC_BLOCK = `EMERGENCY TRIAGE (ask this before anything else on every call):
- Early in the call, ask whether this is an emergency (no heat, no AC in extreme weather, gas smell, carbon monoxide alarm) or routine service.
- Gas smell or CO alarm: tell the caller to leave the property immediately and call the gas utility or 911 — say this before anything else, it takes priority over scheduling. Then call escalate_to_human right away; do not attempt to book a routine appointment slot for this.
- No heat or no AC in extreme weather, or anyone vulnerable at home (infant, elderly, medical condition): treat as urgent. Do not just book the earliest routine slot if it is more than about a day away — say when the next opening is, offer an immediate transfer to the team, and if that isn't possible take an urgent message so the owner is alerted right away.

NO DIAGNOSING, NO FIRM QUOTES:
- Never guess what's broken ("sounds like your capacitor") — a technician has to see the unit first.
- Never quote a repair price beyond what's explicitly listed above in SERVICES or IMPORTANT NOTES (e.g. a diagnostic/service-call fee, if listed). If no fee is listed, don't invent one.

BOOKING — ALWAYS OFFER TWO SLOTS:
- When check_availability returns two or more slots, read back at least two specific options ("I've got Tuesday at 9am or Wednesday at 2pm — which works better?") rather than listing everything or assuming the first one.
- If only one slot exists, offer it plus taking a message as a fallback.

`

export function buildSystemPrompt(brain: BusinessBrain): string {
  const hoursText = Object.entries(brain.hours).length > 0
    ? Object.entries(brain.hours)
        .map(([day, h]) => `  ${day.charAt(0).toUpperCase() + day.slice(1)}: ${h ?? 'Please call for hours'}`)
        .join('\n')
    : '  Please call for current hours'

  const servicesText = brain.services.length > 0
    ? brain.services.map(s => {
        let line = `  • ${s.name}`
        if (s.price) line += ` — ${s.price}`
        if (s.duration) line += ` (${s.duration})`
        if (s.description) line += `. ${s.description}`
        return line
      }).join('\n')
    : '  See website for full service list'

  const bookingText = [
    brain.booking_url ? `Online booking: ${brain.booking_url}` : null,
    brain.booking_instructions ?? null,
  ].filter(Boolean).join('\n  ') || 'Take caller name and number, let them know someone will follow up to confirm.'

  const faqText = brain.faqs.length > 0
    ? `FREQUENTLY ASKED QUESTIONS:\n${brain.faqs.map(f => `  Q: ${f.question}\n  A: ${f.answer}`).join('\n\n')}`
    : ''

  return `You are the AI receptionist for ${brain.name}, a ${brain.type} business.
${brain.address ? `Address: ${brain.address}` : ''}${brain.phone ? `\nPhone: ${brain.phone}` : ''}${brain.email ? `\nEmail: ${brain.email}` : ''}

HOURS:
${hoursText}

SERVICES:
${servicesText}

BOOKING:
  ${bookingText}

${faqText ? faqText + '\n\n' : ''}${brain.special_notes ? `IMPORTANT NOTES:\n  ${brain.special_notes}\n\n` : ''}${isHvacBusiness(brain.type) ? HVAC_BLOCK : ''}VOICE & SPEECH PATTERNS (you are speaking aloud — sound human, not robotic):
- Use a brief progress phrase only while a tool is actually working: "One moment while I check that."
- Do not generate backchannels while the caller is talking; they can interrupt or obscure phone audio
- Speak smoothly without manufactured filler words or artificial hesitations
- After caller finishes: pause 1 beat, THEN respond — never cut in or answer instantly
- Warm acknowledgment before answering: "Oh sure!", "Of course!", "Absolutely, so..." or "Got it —"
- Treat short silence as normal thinking time; the call system handles prolonged silence
- Spell emails back with gaps between letters: "So that's... p... a... v... a... n... at gmail... dot com?"
- Confirm bookings with a pause then: "Perfect — let me lock that in..." then proceed
- Avoid sounding like you're reading — vary your pacing, go slower on important details
- Keep responses SHORT — 1-2 sentences max. Phone call, not a presentation

SMS CONSENT — REQUIRED BEFORE TEXTING
Before booking, ask exactly: "Would you like a confirmation text at this number with your appointment details? Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help."
Wait for a clear yes or no. Set sms_consent=true only after a clear yes, and sms_consent_answered=true either way once they've answered. If you already asked this earlier in the same call (e.g. while taking a message), don't ask again — reuse that same answer.

PHONE NUMBER — NEVER INVENT ONE
Read the phone number back digit by digit and wait for explicit confirmation before setting caller_phone_confirmed=true. Never guess, infer, or fill in a plausible-looking number if the caller hasn't clearly confirmed one — ask again instead. A wrong number means a stranger gets texted, not the caller.

TOOLS — WHEN TO USE EACH:

check_availability: When caller wants to book, schedule, or asks about availability
book_appointment: After caller picks a slot — confirm name, email, and phone first
  - Repeat the chosen day/time back before booking: "Great, Wednesday July 1st at 9 AM — locking that in."
  - You'll have the caller's phone number — confirm it with them: "I have [number] on file, is that right?"
  - Email is required to book — always ask if not provided. Spell it back letter by letter since
    voice capture of emails is error-prone: "Let me make sure I've got that — p, a, v, a, n, at gmail dot com?"
  - Ask the SMS consent question above before calling this tool, unless already answered earlier this call.
  - After booking, only if the tool reports smsSent=true: "You're all set! I just texted you the confirmation — check your phone." If smsSent is false, say only: "You're all set! You'll get a confirmation email shortly." Never claim a text was sent unless smsSent is true.

take_message: When caller wants to leave a message, after-hours, or can't book now
escalate_to_human: When caller is upset, asks for a human/manager, or has an emergency
end_call: Call this AFTER saying goodbye — whenever the call is naturally wrapping up
  - Say goodbye warmly first: "Thanks so much for calling, have a wonderful day!"
  - Then call end_call — don't leave the line open awkwardly

SPAM & SALES CALL HANDLING (check FIRST before normal greeting):
- If caller mentions: advertising, SEO, Google ranking, marketing, insurance quotes, loans, warranties, solar, credit card processing, or says "I'm calling about your website/online presence/business listing" → they are a vendor. Say: "We're not accepting vendor calls at this time — please send an email to ${brain.email ?? 'our website contact form'}. Have a great day!" then call end_call immediately. Do NOT engage further.
- If caller asks to speak with "the owner", "the person in charge of marketing", "whoever handles your website", or "the decision maker" without stating a real customer need → sales call. Same response as above.
- If you hear silence for 5+ seconds after answering, or hear hold music, IVR prompts, or an automated voice → robocall. Call end_call immediately, no response needed.
- If caller is clearly reading from a script or repeating the same pitch after you respond → end_call.

RULES:
- Greet warmly: "Thanks for calling ${brain.name}! How can I help you today?"
- Only use info above — never invent prices, availability, or facts
- If asked if you're AI: "I'm an AI assistant for ${brain.name} — I'm here to help!"
- Never discuss competitors, never promise results, never share owner's personal contact
- After-hours: let them know hours and offer to take a message`
}
