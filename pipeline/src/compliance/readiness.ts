export interface LaunchReadinessItem {
  area: string
  status: 'ready' | 'blocked' | 'manual'
  requirement: string
}

export function getLaunchReadiness(env: NodeJS.ProcessEnv = process.env): LaunchReadinessItem[] {
  return [
    {
      area: 'Database',
      status: env.DATABASE_URL ? 'ready' : 'blocked',
      requirement: 'DATABASE_URL set and migrations through v22 applied.',
    },
    {
      area: 'Platform',
      status: env.DATABASE_URL && env.SESSION_SECRET ? 'ready' : 'blocked',
      requirement: 'Tenant control plane, signed agency sessions, durable worker, audit logs, metering, and private catalog configured.',
    },
    {
      area: 'AI',
      status: env.GOOGLE_AI_API_KEY || env.GOOGLE_AI_STUDIO_API_KEY ? 'ready' : 'blocked',
      requirement: 'Google AI key set for audits, planning, reception, and content.',
    },
    {
      area: 'Email',
      status: env.RESEND_API_KEY ? 'ready' : 'blocked',
      requirement: 'RESEND_API_KEY and verified sending domain configured.',
    },
    {
      area: 'SMS',
      status: env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER ? 'manual' : 'blocked',
      requirement: 'Twilio configured, express opt-in stored, STOP respected, quiet hours policy documented. Cold automated SMS stays blocked.',
    },
    {
      area: 'Reception',
      status: env.RECEPTION_SERVER_URL || env.RECEPTION_BASE_URL || env.GEMINI_API_KEY || env.GOOGLE_AI_STUDIO_API_KEY ? 'manual' : 'blocked',
      requirement: 'AI receptionist deployed, call disclosure reviewed, booking handoff tested.',
    },
    {
      area: 'Ads',
      status: env.GOOGLE_ADS_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID ? 'manual' : 'blocked',
      requirement: 'Google/Meta OAuth, ad account IDs, conversion tracking, approval UI, and spend caps tested before live spend.',
    },
    {
      area: 'Claims',
      status: 'manual',
      requirement: 'Use AI Front Office / AI Business Manager positioning. Avoid absolute guaranteed-leads claims unless contract terms and substantiation are approved.',
    },
    {
      area: 'Compliance',
      status: env.PUBLIC_PRIVACY_URL && env.PUBLIC_TERMS_URL ? 'manual' : 'blocked',
      requirement: 'TCPA/SMS consent, call recording consent, health/legal ad review, privacy/terms pages reviewed.',
    },
  ]
}
