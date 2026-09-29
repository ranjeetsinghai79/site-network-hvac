export type ComplianceSeverity = 'blocker' | 'warning' | 'info'

export interface ComplianceIssue {
  code: string
  severity: ComplianceSeverity
  message: string
  fix: string
}

export interface ComplianceCheckInput {
  channel: 'sms' | 'email' | 'call' | 'social' | 'ad' | 'website'
  platform?: 'google_ads' | 'meta_ads' | 'instagram_ads' | 'facebook' | 'instagram' | 'google_business_profile'
    | 'linkedin' | 'threads' | 'x' | 'tiktok' | 'pinterest' | 'youtube' | 'nextdoor'
  niche?: string
  text: string
  dailyBudget?: number
  hasExplicitConsent?: boolean
  requiresApproval?: boolean
}

export interface ComplianceCheckResult {
  approvedForDraft: boolean
  approvedForPublish: boolean
  issues: ComplianceIssue[]
}
