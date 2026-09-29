export interface BusinessBrain {
  name: string
  type: string
  address?: string
  phone?: string
  email?: string
  hours: Record<string, string>        // { monday: "9am-5pm", tuesday: "closed", ... }
  services: Array<{
    name: string
    price?: string
    duration?: string
    description?: string
  }>
  booking_url?: string
  booking_instructions?: string
  faqs: Array<{ question: string; answer: string }>
  special_notes?: string
  owner_phone?: string                  // HITL escalation target
  heroImage?: string                    // og:image or first content image — preview-page hero only, never used in the spoken prompt
}

export interface ReceptionConfig {
  id: string
  lead_id?: string
  website_url: string
  business_name: string
  brain: BusinessBrain
  system_prompt: string
  twilio_phone?: string
  cal_api_key?: string | null
  cal_event_type_id?: number | null
  timezone?: string | null
  calendar_provider?: 'google' | 'cal' | null
  google_refresh_token_enc?: string | null
  google_account_email?: string | null
  calendar_settings?: unknown
  /** Origins the embeddable widget will accept connections from for this client. Null = derive from website_url. */
  widget_allowed_origins?: string[] | null
  active: boolean
  created_at: string
}
