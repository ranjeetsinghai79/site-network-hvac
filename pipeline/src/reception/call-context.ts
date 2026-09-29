// Best-effort same-instance cache. Durable routing metadata is also encoded in
// the Twilio voice URL/custom parameters so multi-instance scaling is safe.

export interface CallMeta {
  configId: string
  leadName?: string
  demoUrl?: string
  triggerType?: 'email_click' | 'sms_reply' | 'form_submit' | 'manual'
  isOutbound?: boolean
}

export const callMeta = new Map<string, CallMeta>() // callSid → meta
