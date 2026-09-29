/**
 * sms-reply-handler.ts
 *
 * ⚠️  DEAD CODE — not wired to anything live. The real inbound /sms/reply
 * webhook (verified against Twilio's Messaging Service inbound_request_url)
 * is handled entirely inside api/src/index.ts's handleSMSWebhook() (the
 * "Sofia" agent) — a separate Cloudflare Worker deploy target. Nothing in
 * this repo imports or calls this file. Left in place for reference only;
 * don't edit expecting it to affect live behavior.
 *
 * Handles inbound SMS replies from leads via Twilio webhook.
 * Gemini 2.5 Flash drives the conversation — knows the lead's name,
 * niche, demo URL, price tier, and current status.
 *
 * Flow:
 *   Lead replies → Twilio POSTs to /api/sms/reply → this handler
 *   → Gemini generates reply → send via Twilio → update DB status
 *
 * Status transitions:
 *   sms_sent → conversation_active → meeting_scheduled → payment_link_sent
 *
 * Conversation states:
 *   "YES" / "interested" → send Calendly link, update status
 *   "STOP" / "opt out"   → set sms_opt_out=true, stop all comms
 *   "price?" / "how"     → Gemini handles objection
 *   "no" / "not now"     → polite follow-up in 3 days (future)
 */

import { geminiText, GEMINI_FLASH } from '../tools/gemini.js'
import { sendSMS } from './sms-outreach.js'
import type { Lead } from '../types.js'

const CALENDLY_URL = process.env.CALENDLY_URL ?? 'https://cal.com/ranjeet-singh-iw1omu/15min'

// ─── System prompt for the SMS AI sales agent ────────────────────────────────

function buildSystemPrompt(lead: Lead): string {
  const demoUrl = lead.vercel_url ?? lead.cloudflare_url ?? ''
  const tier = lead.tier ?? (lead.website ? 'tier2' : 'tier1')
  const price = tier === 'tier1' ? '$299 one-time + $69/mo founding rate (hosting, AI reception, GBP posts, review replies, booking, SMS automation — all included)' : '$599 one-time + $79/mo'

  return `You are a friendly, professional website sales rep for WebCrew.
You are texting ${lead.name}, a local ${lead.niche} business in ${lead.city}, ${lead.state}.

Context:
- You already built them a demo website: ${demoUrl}
- Price: ${price}
- Their situation: ${tier === 'tier1' ? 'currently has NO website' : `website scored ${lead.site_score}/100 on Google speed test`}
- They just replied to your initial outreach text

Your job:
- Be SHORT. Max 3 sentences per reply. This is SMS.
- Be warm but direct. Not salesy.
- If they say YES or show interest → send them the Calendly link to schedule a quick call: ${CALENDLY_URL}
- If they ask about price → confirm price, emphasize value (one new customer pays for it)
- If they have objections → address briefly, invite them to a 15-min call
- If they say STOP/unsubscribe/opt out → just reply "Got it, removing you from our list. Have a great day!" (nothing else)
- Never send more than 3 SMS in one conversation without human review
- Never promise specific Google rankings or traffic numbers

Keep replies under 160 characters when possible (1 SMS = 1 charge).
Do NOT use emojis unless they used one first.`
}

// ─── Detect opt-out keywords ─────────────────────────────────────────────────

function isOptOut(text: string): boolean {
  const t = text.toLowerCase().trim()
  return ['stop', 'unsubscribe', 'quit', 'cancel', 'optout', 'opt out',
          'remove me', 'dont text', "don't text", 'no thanks', 'not interested'].some(k => t.includes(k))
}

// ─── Detect strong buying signal ─────────────────────────────────────────────

function isStrongInterest(text: string): boolean {
  const t = text.toLowerCase().trim()
  return ['yes', 'yeah', 'yep', 'interested', 'tell me more', 'how do i',
          'sounds good', 'let\'s do it', 'i want', 'sign me up'].some(k => t.includes(k))
}

// ─── Main reply handler ───────────────────────────────────────────────────────

export interface SMSReply {
  from: string      // lead phone number
  body: string      // their message
  smsSid: string
}

export interface ReplyResult {
  responded: boolean
  reply?: string
  optOut?: boolean
  meetingOffered?: boolean
  triggerBuild?: boolean  // Track C: warm-tease lead said YES, enqueue build pipeline
  updatedStatus?: Lead['status']
}

export async function handleSMSReply(
  incoming: SMSReply,
  lead: Lead
): Promise<ReplyResult> {
  const text = incoming.body.trim()

  // ── Opt-out: immediate, no Gemini needed ────────────────────────────────
  if (isOptOut(text)) {
    const goodbye = "Got it, removing you from our list. Have a great day!"
    await sendSMS(incoming.from, goodbye)
    console.log(`[SMS Reply] ${lead.name} opted out`)
    return { responded: true, reply: goodbye, optOut: true, updatedStatus: 'sms_sent' }
  }

  // ── Strong YES: check if demo already built ─────────────────────────────
  if (isStrongInterest(text)) {
    const hasDemoSite = !!(lead.vercel_url ?? lead.cloudflare_url)

    if (!hasDemoSite && lead.tier === 'tier2') {
      // Track C: warm tease lead said YES — trigger build, hold them
      const reply = `Awesome! Give me ~10 minutes to put together a custom version for ${lead.name}. I'll text you the link shortly.`
      await sendSMS(incoming.from, reply)
      console.log(`[SMS Reply] ${lead.name} (Track C) said YES — needs build triggered`)
      // Caller must enqueue a build job for this lead after receiving this result
      return {
        responded: true,
        reply,
        meetingOffered: false,
        updatedStatus: 'conversation_active',
        triggerBuild: true,
      }
    }

    const reply = `Great! Let's set up a quick 15-min call to get your site live: ${CALENDLY_URL}`
    await sendSMS(incoming.from, reply)
    console.log(`[SMS Reply] ${lead.name} interested — sent Calendly`)
    return {
      responded: true,
      reply,
      meetingOffered: true,
      updatedStatus: 'meeting_scheduled',
    }
  }

  // ── General reply: Gemini handles it ────────────────────────────────────
  try {
    const systemPrompt = buildSystemPrompt(lead)
    const userMessage = `The lead said: "${text}"\n\nWrite a single SMS reply (max 160 chars). Do not include quotes or labels, just the reply text.`

    const reply = (await geminiText(userMessage, {
      model: GEMINI_FLASH,
      systemInstruction: systemPrompt,
    })).trim().replace(/^["']|["']$/g, '')
    console.log(`[SMS Reply] ${lead.name}: "${text}" → "${reply}"`)

    await sendSMS(incoming.from, reply)

    // Check if Gemini's reply included Calendly (it might offer it naturally)
    const offeredMeeting = reply.includes('calendly') || reply.includes('call') || reply.includes('schedule')

    return {
      responded: true,
      reply,
      meetingOffered: offeredMeeting,
      updatedStatus: 'conversation_active',
    }
  } catch (e: any) {
    console.error(`[SMS Reply] Gemini error: ${e.message}`)
    // Fallback: human-like holding reply
    const fallback = `Thanks for your reply! I'll get back to you shortly. To book a quick chat: ${CALENDLY_URL}`
    await sendSMS(incoming.from, fallback)
    return { responded: true, reply: fallback, updatedStatus: 'conversation_active' }
  }
}
