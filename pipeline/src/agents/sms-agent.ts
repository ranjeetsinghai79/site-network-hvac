/**
 * SMS Agent — Twilio-powered outreach + AI conversation
 *
 * Handles:
 * 1. Initial outreach SMS with demo link
 * 2. AI-driven conversation responses (Gemini)
 * 3. Meeting scheduling trigger (Calendly link)
 * 4. Stripe payment link delivery
 * 5. Opt-out handling (STOP keyword)
 *
 * Webhook: POST /api/sms/webhook (receives Twilio inbound)
 * Deploy this pipeline as an API server for webhook handling.
 */

import { geminiText, GEMINI_FLASH } from '../tools/gemini.js'
import { canTextNow }               from '../tools/sms-consent.js'
import type { Lead, AgentResult }   from '../types.js'

const SMS_SYSTEM = `You are a friendly, professional representative for MedSpaOS — an AI revenue operating system built specifically for independent med spas.
MedSpaOS turns missed calls, no-shows, post-consult drop-offs, and dormant patients into booked, completed, repeat revenue — without extra staff or new leads.
Keep responses conversational, brief (2-3 sentences max for SMS), warm but professional.
Never be pushy. Focus on what the med spa owner is losing right now and how MedSpaOS recovers it.
Do not pitch websites. Pitch revenue recovery from existing patients and leads.`

// ─── Message templates ──────────────────────────────────────────────────────

function buildInitialSms(lead: Lead): string {
  return `Hi — missed calls, no-shows, and consults that never booked are costing ${lead.name} real revenue every week.

MedSpaOS follows up automatically so nothing falls through. Takes 15 min to set up. Reply INTERESTED to see how or STOP to opt out.`
}

function buildMeetingLinkSms(lead: Lead): string {
  const meetingUrl = process.env.CALENDLY_URL || 'https://cal.com/ranjeet-singh-iw1omu/15min'
  return `Here's a link to book a quick 15-min call: ${meetingUrl}

I'll show you exactly what MedSpaOS would do for ${lead.name} — no pitch, just the numbers. No pressure.`
}

function buildPaymentSms(lead: Lead): string {
  const paymentUrl = lead.stripe_payment_url || ''
  const price = process.env.MEDSPAOS_PRICE || '$99/mo'
  return `Ready to start? Secure your spot here (${price}): ${paymentUrl}

You're live within 7 days. Cancel any time. We'll set everything up for you.`
}

// ─── Send SMS via Twilio ────────────────────────────────────────────────────

async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[SMS] Twilio not configured — would send to ${to}: ${body.slice(0, 60)}...`)
    return false
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const params = new URLSearchParams({ To: to, From: fromNumber, Body: body })
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error(`[SMS] Twilio error: ${err}`)
      return false
    }
    return true
  } catch (e: any) {
    console.error(`[SMS] Send failed: ${e.message}`)
    return false
  }
}

// ─── AI response to inbound message ────────────────────────────────────────

export async function generateAiReply(
  lead: Lead,
  inboundMessage: string,
  conversationHistory: Array<{ role: 'user' | 'model'; text: string }>
): Promise<string> {
  const upperMsg = inboundMessage.toUpperCase().trim()

  // Hard keywords — no AI needed
  if (['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(upperMsg)) {
    return 'You have been unsubscribed. No more messages from us. Reply START to resubscribe.'
  }
  if (['START', 'YES', 'INTERESTED', 'SURE', 'OK', 'OKAY'].includes(upperMsg)) {
    return buildMeetingLinkSms(lead)
  }
  if (['PAYMENT', 'PAY', 'PRICE', 'COST', 'HOW MUCH', 'BUY'].some(k => upperMsg.includes(k))) {
    return buildPaymentSms(lead)
  }

  // AI-generated reply
  const contextPrompt = `Lead: ${lead.name}, ${lead.niche} business in ${lead.city}, ${lead.state}.
Demo site: ${lead.vercel_url || lead.cloudflare_url || 'being prepared'}
${lead.stripe_payment_url ? `Payment link available: yes` : ''}

Conversation history:
${conversationHistory.map(m => `${m.role === 'user' ? 'Them' : 'You'}: ${m.text}`).join('\n')}

Their latest message: "${inboundMessage}"

Reply in 2-3 sentences max. Be helpful and warm. If they seem interested, offer meeting link. If they ask price, share payment link.`

  try {
    return (await geminiText(contextPrompt, { model: GEMINI_FLASH, maxTokens: 512, temperature: 0.7, systemInstruction: SMS_SYSTEM })).trim()
  } catch {
    return `Thanks for your message! Would you like to hop on a quick 15-min call to see your demo site? Here's a link: ${process.env.CALENDLY_URL || 'https://cal.com/ranjeet-singh-iw1omu/15min'}`
  }
}

// ─── Main agent ─────────────────────────────────────────────────────────────

// Day-3/day-10 follow-up drip lives in scripts/drip-followup.ts, not here.
type SmsType = 'initial' | 'meeting_link' | 'payment'

export async function runSmsAgent(
  lead: Lead,
  type: SmsType = 'initial'
): Promise<AgentResult<Lead>> {
  if (!lead.phone) return { success: false, error: 'No phone number' }
  if (lead.can_sms === false) return { success: false, error: `Landline — SMS not deliverable (${lead.phone_type ?? 'landline'})` }
  // Fresh DB check (not lead.sms_opt_out, which can be stale in-memory) — covers
  // both opt-out and active-consent in one atomic read. See sms-consent.ts.
  if (!(await canTextNow(lead.phone))) return { success: false, error: 'Not textable — opted out or no SMS consent on file (TCPA gate, email-only lead)' }

  const messageMap: Record<SmsType, (l: Lead) => string> = {
    initial:      buildInitialSms,
    meeting_link: buildMeetingLinkSms,
    payment:      buildPaymentSms,
  }

  const body = messageMap[type](lead)
  console.log(`[SMS] ${type} → ${lead.phone} (${lead.name})`)

  const sent = await sendSms(lead.phone, body)

  const updatedLead: Lead = {
    ...lead,
    sms_sent: true,
    sms_sent_at: new Date().toISOString(),
    status: type === 'initial' ? 'sms_sent' : lead.status,
  }

  return { success: sent || !process.env.TWILIO_ACCOUNT_SID, data: updatedLead }
}

// ─── Webhook handler (called from API route) ──────────────────────────────

export interface TwilioWebhookBody {
  From: string
  To: string
  Body: string
  MessageSid: string
}

export async function handleSmsWebhook(
  body: TwilioWebhookBody,
  findLeadByPhone: (phone: string) => Promise<Lead | null>,
  getHistory: (leadId: string) => Promise<Array<{ role: 'user' | 'model'; text: string }>>,
  saveMessage: (leadId: string, role: 'user' | 'model', text: string) => Promise<void>,
  updateLeadFn: (lead: Lead) => Promise<void>
): Promise<string> {
  const { From, Body } = body
  const upperBody = Body.toUpperCase().trim()

  const lead = await findLeadByPhone(From)
  if (!lead) {
    // Unknown number — polite response
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Thanks for your message! We don't have your demo ready yet. Text us your business name and we'll get it to you shortly.</Message></Response>`
  }

  // Save inbound message
  if (lead.id) await saveMessage(lead.id, 'user', Body)

  // Handle opt-out
  if (['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(upperBody)) {
    await updateLeadFn({ ...lead, sms_opt_out: true })
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You've been unsubscribed. No more messages from us.</Message></Response>`
  }

  // Handle interested / YES
  if (['START', 'YES', 'INTERESTED', 'SURE'].includes(upperBody)) {
    const updatedLead = { ...lead, status: 'conversation_active' as const }
    await updateLeadFn(updatedLead)
  }

  // Generate AI reply
  const history = lead.id ? await getHistory(lead.id) : []
  const reply = await generateAiReply(lead, Body, history)

  // Save outbound
  if (lead.id) await saveMessage(lead.id, 'model', reply)

  // Check if reply contains payment link — update status
  if (reply.includes(lead.stripe_payment_url || '___NOPE___')) {
    await updateLeadFn({ ...lead, status: 'payment_link_sent' })
  }

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`
}
