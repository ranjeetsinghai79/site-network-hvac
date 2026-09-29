/**
 * phone-lookup.ts
 *
 * Free, offline phone type detection using libphonenumber-js.
 * Classifies numbers as mobile, landline, voip, toll-free, or unknown.
 * Determines whether a number can receive SMS.
 *
 * Accuracy notes:
 *   - International (India, UK, etc.): ~95% accurate
 *   - US/Canada: ~60-70% — number portability means ported numbers
 *     may be misclassified. Use Twilio Lookup for 100% US accuracy.
 *
 * SMS-capable types: mobile, voip (some carriers support it)
 * NOT SMS-capable:   landline, toll-free, premium-rate, pager
 */

import { parsePhoneNumber } from 'libphonenumber-js/max'

export type PhoneLineType =
  | 'mobile'
  | 'landline'
  | 'voip'
  | 'toll-free'
  | 'unknown'

export interface PhoneLookupResult {
  lineType:   PhoneLineType
  canSms:     boolean
  e164?:      string   // normalized E.164 format e.g. +15125551234
}

// Map libphonenumber number types to our simplified set
// See: https://gitlab.com/catamphetamine/libphonenumber-js#getnumbertype
const TYPE_MAP: Record<string, PhoneLineType> = {
  MOBILE:               'mobile',
  FIXED_LINE:           'landline',
  FIXED_LINE_OR_MOBILE: 'unknown',   // US portability — cannot determine offline
  VOIP:                 'voip',
  TOLL_FREE:            'toll-free',
  PREMIUM_RATE:         'landline',
  SHARED_COST:          'landline',
  PERSONAL_NUMBER:      'mobile',
  PAGER:                'landline',
  UAN:                  'landline',
  UNKNOWN:              'unknown',
}

// Block SMS only when we're CERTAIN it can't receive texts.
// 'unknown' (e.g. US due to number portability) = attempt SMS anyway — Twilio handles delivery failure.
const SMS_BLOCKED = new Set<PhoneLineType>(['landline', 'toll-free'])

/**
 * Infer country from state string for US/Canada, else try to parse as-is.
 * Falls back to 'US' when country cannot be determined.
 */
function inferCountry(phone: string, state?: string): string {
  if (phone.startsWith('+')) return 'ZZ'  // already has country code — let libphonenumber figure it out
  const s = (state ?? '').toUpperCase()
  // Canadian provinces
  const CA_PROVINCES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])
  if (CA_PROVINCES.has(s)) return 'CA'
  // Indian states / country label
  if (s === 'INDIA' || s === 'IN' || phone.startsWith('0') && phone.length >= 10) return 'IN'
  return 'US'
}

export function lookupPhoneType(rawPhone: string, state?: string): PhoneLookupResult {
  if (!rawPhone) return { lineType: 'unknown', canSms: false }

  // Strip common formatting
  const cleaned = rawPhone.replace(/[\s\-().]/g, '')

  try {
    const country = inferCountry(cleaned, state)
    const parsed  = country === 'ZZ'
      ? parsePhoneNumber(cleaned)
      : parsePhoneNumber(cleaned, country as any)

    if (!parsed || !parsed.isValid()) {
      return { lineType: 'unknown', canSms: false }
    }

    let rawType = (parsed.getType() as string | undefined) ?? 'UNKNOWN'

    // India heuristic: +91 numbers starting with 2-6 are landlines; 7-9 mobile
    // (libphonenumber returns undefined for some IN landlines even in /max)
    if (rawType === 'UNKNOWN' && parsed.country === 'IN') {
      const national = parsed.nationalNumber.toString()
      rawType = /^[2-6]/.test(national) ? 'FIXED_LINE' : 'MOBILE'
    }

    const lineType = TYPE_MAP[rawType] ?? 'unknown'
    const canSms   = !SMS_BLOCKED.has(lineType)

    return {
      lineType,
      canSms,
      e164: parsed.format('E.164'),
    }
  } catch {
    return { lineType: 'unknown', canSms: false }
  }
}
