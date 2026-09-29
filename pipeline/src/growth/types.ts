import type { AuditReport, Lead } from '../types.js'

export type GrowthAgentType =
  | 'business_intelligence'
  | 'website_builder'
  | 'reception'
  | 'seo'
  | 'aeo'
  | 'geo'
  | 'content'
  | 'social'
  | 'ads'
  | 'analytics'
  | 'cro'

export type AutonomyLevel = 1 | 2 | 3 | 4

export interface GrowthWorkspace {
  id?: string
  businessName: string
  websiteUrl: string
  industry?: string
  city?: string
  state?: string
  goals: string[]
  autonomyLevel: AutonomyLevel
  connectedAccounts: GrowthIntegration[]
  currentPlan?: GrowthPlan
  createdAt?: string
  updatedAt?: string
}

export interface GrowthIntegration {
  provider:
    | 'google_search_console'
    | 'google_business_profile'
    | 'google_ads'
    | 'meta'
    | 'instagram'
    | 'tiktok'
    | 'youtube'
    | 'twilio'
    | 'n8n'
  status: 'not_connected' | 'connected' | 'error'
  accountLabel?: string
}

export interface GrowthPlan {
  workspaceId?: string
  businessName: string
  websiteUrl: string
  summary: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  tracks: GrowthPlanTrack[]
  initialTasks: GrowthAgentTask[]
  approvalPolicy: GrowthApprovalPolicy
  createdAt: string
}

export interface GrowthPlanTrack {
  id: string
  title: string
  agentType: GrowthAgentType
  priority: 'critical' | 'high' | 'medium' | 'low'
  objective: string
  successMetric: string
}

export interface GrowthAgentTask {
  id: string
  workspaceId?: string
  agentType: GrowthAgentType
  title: string
  input: Record<string, unknown>
  status: 'queued' | 'running' | 'needs_approval' | 'completed' | 'failed'
  priority: 'critical' | 'high' | 'medium' | 'low'
  requiresApproval: boolean
  createdAt: string
}

export interface GrowthAgentResult {
  taskId: string
  success: boolean
  output?: Record<string, unknown>
  recommendedNextActions: string[]
  metrics?: Record<string, number | string | boolean>
  error?: string
}

export interface GrowthApprovalPolicy {
  autonomyLevel: AutonomyLevel
  requiresApprovalFor: Array<
    | 'publish_content'
    | 'launch_ads'
    | 'change_budget'
    | 'change_domain'
    | 'send_outreach'
    | 'modify_live_site'
  >
}

export interface GrowthBrainInput {
  workspace?: Partial<GrowthWorkspace>
  lead?: Lead
  audit?: AuditReport
}
