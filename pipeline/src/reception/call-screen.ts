// Inbound call screening for WebCrew's OWN lines (sales + demo). Paying clients' lines are never gated —
// a real customer calling a business must not hit an extra step.
//
// Why this exists: the demo line was hit by ~85 spoofed +1918 robocalls over 7 days ("press one to verify…").
// Each one opened a paid Gemini stream and polluted every "callers" metric. See CLAUDE.md, Client-Mode AI Reception.

export type StirLevel = 'A' | 'B' | 'C' | 'failed' | 'none'
export type Trust = 'owner' | 'self' | 'widget' | 'human' | 'suspected_bot' | 'no_speech' | 'unknown'

export const last10 = (n?: string | null): string => (n ?? '').replace(/\D/g, '').slice(-10)

/** Twilio's `StirVerstat` webhook param: TN-Validation-Passed-A|B|C, TN-Validation-Failed-*, No-TN-Validation. */
export function stirLevel(v?: string | null): StirLevel {
  const m = (v ?? '').trim().match(/^TN-Validation-(Passed|Failed)-([ABC])$/i)
  if (!m) return 'none'
  return m[1].toLowerCase() === 'failed' ? 'failed' : (m[2].toUpperCase() as 'A' | 'B' | 'C')
}

// Recorded-message / IVR phrases. Deliberately narrow: a false positive hangs up on a real person.
// Live transcription arrives in word fragments ("Pre ss one", "tro uble fi nding you"), so each pattern
// allows an optional space inside the words most often split.
// The real one seen on the demo line (85 calls): "Clients are currently having trouble finding you. Press one to
// speak with an agent immediately and verify your Google listing." — a Google-listing scam robocall.
const ROBOCALL_PATTERNS: RegExp[] = [
  /\bpre\s?ss\s+(?:one|1|two|2|nine|9)\b/i,
  /\btro\s?u\s?ble\s+f\s?i\s?nding\s+you\b/i,
  /\bverify\s+your\s+go\s?ogle\s+lis\s?ting\b/i,
  /\bthis\s+is\s+an?\s+(?:auto\s?mated|re\s?corded|pre\s?recorded)\b/i,
  /\bat\s+the\s+(?:tone|beep)\b/i,
  /\bleave\s+(?:your\s+|a\s+)?message\s+after\b/i,
  /\byour\s+(?:car'?s?\s+)?extended\s+war\s?ranty\b/i,
]

export function looksLikeRobocall(text: string): boolean {
  if (!text) return false
  const collapsed = text.replace(/\s+/g, ' ')
  return ROBOCALL_PATTERNS.some(p => p.test(collapsed))
}

/** Everything the caller said, from a stored/merged "AI: … Caller: …" transcript. */
export function callerText(transcript: string): string {
  const out: string[] = []
  const re = /(?:^|\s)(AI|Caller|Visitor):\s?/g
  const marks: Array<{ who: string; at: number; end: number }> = []
  for (let m = re.exec(transcript); m; m = re.exec(transcript)) marks.push({ who: m[1], at: m.index, end: m.index + m[0].length })
  marks.forEach((mk, i) => { if (mk.who !== 'AI') out.push(transcript.slice(mk.end, marks[i + 1]?.at ?? transcript.length)) })
  return out.join(' ')
}

const alnum = (s: string) => s.replace(/[^a-z0-9]/gi, '').length

export function classifyTrust(i: {
  caller: string | null
  channel?: 'phone' | 'widget'
  ownerPhones?: string[]
  selfNumbers?: Array<string | null | undefined>
  transcript: string
  stir?: string | null
  gatePassed?: boolean
}): Trust {
  if (i.channel === 'widget') return 'widget'
  const c = last10(i.caller)
  if (c && (i.ownerPhones ?? []).some(n => last10(n) === c)) return 'owner'
  if (c && (i.selfNumbers ?? []).some(n => last10(n) && last10(n) === c)) return 'self'

  const said = callerText(i.transcript)
  if (looksLikeRobocall(said)) return 'suspected_bot'
  const chars = alnum(said)
  if (chars < 3) return stirLevel(i.stir) === 'failed' ? 'suspected_bot' : 'no_speech'
  if (stirLevel(i.stir) === 'failed' && chars < 40) return 'suspected_bot'
  if (i.gatePassed && chars >= 10) return 'human'
  if (chars >= 25) return 'human'
  return 'unknown'
}

/** Numbers that skip the screen and its caps (the owner testing their own line). */
export function ownerPhones(): string[] {
  return (process.env.OWNER_PHONES ?? '+14156060079,+14695500069').split(',').map(s => s.trim()).filter(Boolean)
}

export const isOwnerPhone = (caller?: string | null): boolean => !!last10(caller) && ownerPhones().some(n => last10(n) === last10(caller))

export function gateEnabled(): boolean {
  return process.env.CALL_GATE_ENABLED !== 'false'
}

const xmlAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** "Press 1" step. A recorded robocall can't answer it; a person can. No digit → polite hangup, no AI stream, no cost. */
export function gateTwiml(businessName: string, actionUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" timeout="6" action="${xmlAttr(actionUrl)}" method="POST">
    <Say voice="Polly.Joanna-Neural">Thanks for calling ${businessName.replace(/[<>&]/g, '')}. To talk with our A I receptionist, press 1.</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">We didn't get a response. Goodbye.</Say>
  <Hangup/>
</Response>`
}

export function declineTwiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${message.replace(/[<>&]/g, '')}</Say>
  <Hangup/>
</Response>`
}

/** What a caller hears when the AI can't start (database down, bad data). Rings the owner's own cell when we know it
 *  from the last-known-good config, so an outage costs a slower answer instead of a lost call. Never dials the line's
 *  own number: a forwarded business line would loop straight back here. */
export function outageTwiml(ownerPhone?: string | null, ownNumber?: string | null): string {
  const owner = last10(ownerPhone)
  if (owner.length === 10 && owner !== last10(ownNumber)) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Thanks for calling. Our assistant is unavailable for a moment, so we are connecting you to the team.</Say>
  <Dial timeout="25">+1${owner}</Dial>
  <Say voice="Polly.Joanna-Neural">We could not reach anyone right now. Please call back in a few minutes. Goodbye.</Say>
  <Hangup/>
</Response>`
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Thanks for calling. We are having a technical problem and cannot take your call right now. Please try again in a few minutes.</Say>
  <Hangup/>
</Response>`
}
