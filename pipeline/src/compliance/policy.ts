import type { ComplianceCheckInput, ComplianceCheckResult, ComplianceIssue } from './types.js'

const HEALTH_NICHES = new Set([
  'medspa',
  'skin-clinic',
  'iv-therapy',
  'dentist',
  'orthodontist',
  'weight-loss-clinic',
])

const PERSONAL_ATTRIBUTE_PATTERNS = [
  /\bdo you (have|suffer|struggle)\b/i,
  /\bare you (overweight|bald|in pain|unhappy|embarrassed)\b/i,
  /\byour (wrinkles|acne|weight|debt|injury|condition)\b/i,
]

const PROHIBITED_CLAIMS = [
  /\bguarantee(d)?\b.*\b(results|rankings|leads|revenue|appointments)\b/i,
  /\b(cure|treat|diagnose|reverse)\b/i,
  /\blose \d+\s?(lbs|pounds)\b/i,
  /\bpermanent weight loss\b/i,
  /\b#1\b.*\bwithout proof\b/i,
]

const FINANCIAL_LEGAL_PROMISES = [
  /\bguarantee(d)?\b.*\bsettlement|case|approval|return\b/i,
  /\bno risk\b/i,
]

export function checkCompliance(input: ComplianceCheckInput): ComplianceCheckResult {
  const issues: ComplianceIssue[] = []
  const text = input.text ?? ''
  const niche = input.niche ?? ''

  if (input.channel === 'sms' && !input.hasExplicitConsent) {
    issues.push({
      code: 'sms-consent-required',
      severity: 'blocker',
      message: 'SMS outreach requires documented opt-in or a permitted business relationship before automated follow-up.',
      fix: 'Capture consent at form submit or keep SMS to manually reviewed responses only.',
    })
  }

  if (input.channel === 'sms' && !/\b(stop|unsubscribe|opt out)\b/i.test(text)) {
    issues.push({
      code: 'sms-optout-language',
      severity: 'warning',
      message: 'SMS copy should include opt-out language.',
      fix: 'Add “Reply STOP to opt out.”',
    })
  }

  if (input.channel === 'call' && !/record/i.test(text)) {
    issues.push({
      code: 'call-recording-disclosure',
      severity: 'warning',
      message: 'AI receptionist flows should disclose AI/recording where applicable.',
      fix: 'Add a short greeting disclosure before recording or routing.',
    })
  }

  for (const pattern of PROHIBITED_CLAIMS) {
    if (pattern.test(text)) {
      issues.push({
        code: 'unsupported-claim',
        severity: 'blocker',
        message: 'Copy contains medical, revenue, ranking, or outcome claims that need proof or removal.',
        fix: 'Replace guarantees with softer language like “designed to help” or “may improve.”',
      })
      break
    }
  }

  if ((input.platform === 'meta_ads' || input.platform === 'instagram_ads') && PERSONAL_ATTRIBUTE_PATTERNS.some((p) => p.test(text))) {
    issues.push({
      code: 'personal-attribute-ad-copy',
      severity: 'blocker',
      message: 'Meta/Instagram ad copy cannot imply personal attributes or conditions.',
      fix: 'Use neutral service language instead of “Do you have…” or “Are you struggling with…”.',
    })
  }

  if (HEALTH_NICHES.has(niche) && input.channel === 'ad') {
    issues.push({
      code: 'health-ad-review',
      severity: 'warning',
      message: 'Health, beauty, dental, IV, and weight-loss ads need stricter review for restricted claims and targeting.',
      fix: 'Require human approval and avoid before/after, body image, cure, or unrealistic outcome claims.',
    })
  }

  if ((niche === 'lawfirm' || niche.includes('financial')) && FINANCIAL_LEGAL_PROMISES.some((p) => p.test(text))) {
    issues.push({
      code: 'legal-financial-claim',
      severity: 'blocker',
      message: 'Legal/financial copy cannot guarantee outcomes.',
      fix: 'Remove guaranteed results and add appropriate disclaimers where needed.',
    })
  }

  if (input.channel === 'ad' && (input.dailyBudget ?? 0) > 50) {
    issues.push({
      code: 'budget-approval-required',
      severity: 'warning',
      message: 'Daily budget exceeds launch-safe default.',
      fix: 'Require owner approval and documented budget cap before publishing.',
    })
  }

  if (input.requiresApproval !== true && ['ad', 'social', 'sms', 'call'].includes(input.channel)) {
    issues.push({
      code: 'approval-gate-required',
      severity: 'blocker',
      message: 'External messaging, ads, calls, and social publishing must be approval-gated at launch.',
      fix: 'Store as needs_approval and publish only after explicit approval.',
    })
  }

  const hasBlocker = issues.some((issue) => issue.severity === 'blocker')
  return {
    approvedForDraft: true,
    approvedForPublish: !hasBlocker && input.requiresApproval === false,
    issues,
  }
}

export function complianceSummary(issues: ComplianceIssue[]): string {
  if (!issues.length) return 'No compliance issues detected. Still requires approval before publishing.'
  return issues.map((issue) => `[${issue.severity}] ${issue.code}: ${issue.fix}`).join('\n')
}
