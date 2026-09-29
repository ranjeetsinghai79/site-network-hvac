// SMS outreach via Twilio
// ⚠️  COMPLIANCE NOTES:
//   - CONSENT-GATED: sends only to numbers with an active consent_events row
//     (form opt-in or inbound reply). Fail-closed. Override: ALLOW_COLD_SMS=true.
//   - All messages MUST include "Reply STOP to opt out" (included below).
//   - Register a 10DLC campaign at console.twilio.com before sending at scale.
//   - STOP opt-outs are handled automatically by Twilio; do NOT message opted-out numbers.
//   - Check Lead.sms_opt_out === true before calling this function.

import { canTextNow } from './sms-consent.js'

const NICHE_LABEL: Record<string, string> = {
  hvac:           'HVAC & Air Conditioning',
  roofing:        'Roofing',
  plumbing:       'Plumbing',
  dentist:        'Dental',
  medspa:         'Med Spa',
  lawfirm:        'Law',
  cleaning:       'Cleaning',
  'auto-detailing':'Auto Detailing',
  'junk-removal': 'Junk Removal',
  daycare:        'Daycare',
  remodeling:     'Remodeling',
  restaurant:     'Restaurant',
}

export async function sendOutreachSMS(params: {
  to: string
  businessName: string
  demoUrl: string
  niche: string
  optedOut?: boolean  // pass lead.sms_opt_out
}): Promise<boolean> {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) return false

  // Never SMS to opted-out numbers
  if (params.optedOut) {
    console.log('[SMS] Skipped — number has opted out')
    return false
  }

  // TCPA gate — not textable (no active consent, or opted out per fresh DB read) → no send
  if (!(await canTextNow(params.to))) {
    console.log(`[SMS] Skipped — not textable for ${params.to} (TCPA gate, email-only lead)`)
    return false
  }

  const { to, businessName, demoUrl, niche } = params
  const nicheLabel = NICHE_LABEL[niche] || niche

  // Strip non-digit chars, add US country code if needed
  const digits = to.replace(/\D/g, '')
  if (digits.length < 10) {
    console.warn('[SMS] Invalid phone number, skipping')
    return false
  }
  const e164 = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

  // TCPA-compliant message: identifies sender, includes opt-out, not deceptive
  const body = [
    `Hi! WebCrew built a free ${nicheLabel} website for ${businessName}.`,
    `See it live: ${demoUrl}`,
    `Reply INTEREST to learn more or STOP to opt out. webcrew.app`,
  ].join(' ')

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: e164, From: from, Body: body,
        StatusCallback: 'https://webcrew-admin.pages.dev/api/webhooks/sms',
      }).toString(),
    }
  )

  const data = await res.json() as any
  if (!res.ok) {
    console.warn('[SMS] Twilio error:', data?.message)
    return false
  }

  console.log(`[SMS] Sent to ${e164}: SID ${data.sid}`)
  return true
}

// Handle inbound STOP / HELP replies (call from your Twilio webhook handler)
export function parseTwilioInbound(body: string): 'stop' | 'help' | 'reply' | null {
  const text = body.trim().toUpperCase()
  if (['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT'].includes(text)) return 'stop'
  if (['HELP','INFO'].includes(text)) return 'help'
  if (text.includes('INTEREST') || text.includes('YES') || text.includes('MORE')) return 'reply'
  return null
}
