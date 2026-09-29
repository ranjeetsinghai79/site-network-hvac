import type { AuditReport } from '../types.js'
import type {
  GrowthAgentTask,
  GrowthBrainInput,
  GrowthPlan,
  GrowthPlanTrack,
  GrowthWorkspace,
} from './types.js'

const DEFAULT_GOALS = ['increase qualified leads', 'improve booking conversion', 'reduce missed calls']

export function createGrowthWorkspace(input: GrowthBrainInput): GrowthWorkspace {
  const audit = input.audit
  const lead = input.lead
  const workspace = input.workspace ?? {}

  return {
    id: workspace.id,
    businessName: workspace.businessName ?? audit?.business_name ?? lead?.name ?? 'Unknown business',
    websiteUrl: workspace.websiteUrl ?? audit?.website_url ?? lead?.website ?? '',
    industry: workspace.industry ?? audit?.niche ?? lead?.niche,
    city: workspace.city ?? audit?.city ?? lead?.city,
    state: workspace.state ?? lead?.state,
    goals: workspace.goals?.length ? workspace.goals : DEFAULT_GOALS,
    autonomyLevel: workspace.autonomyLevel ?? 2,
    connectedAccounts: workspace.connectedAccounts ?? [],
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  }
}

export function createGrowthPlan(input: GrowthBrainInput): GrowthPlan {
  const workspace = createGrowthWorkspace(input)
  const audit = input.audit
  const tracks = prioritizeTracks(audit)
  const createdAt = new Date().toISOString()

  return {
    workspaceId: workspace.id,
    businessName: workspace.businessName,
    websiteUrl: workspace.websiteUrl,
    summary: summarizePlan(workspace, audit, tracks),
    priority: tracks[0]?.priority ?? 'medium',
    tracks,
    initialTasks: tracks.map((track) => createTask(track, workspace, audit, createdAt)),
    approvalPolicy: {
      autonomyLevel: workspace.autonomyLevel,
      requiresApprovalFor: [
        'publish_content',
        'launch_ads',
        'change_budget',
        'change_domain',
        'send_outreach',
        'modify_live_site',
      ],
    },
    createdAt,
  }
}

function prioritizeTracks(audit?: AuditReport): GrowthPlanTrack[] {
  const tracks: GrowthPlanTrack[] = []

  if (!audit || audit.site_broken || audit.website_score < 65 || audit.booking_score < 100) {
    tracks.push({
      id: 'website-conversion',
      title: 'Website conversion foundation',
      agentType: 'website_builder',
      priority: audit?.site_broken ? 'critical' : 'high',
      objective: 'Build or improve the website so visitors can understand the offer and book quickly.',
      successMetric: 'Live conversion-focused page with phone and booking CTA above the fold.',
    })
  }

  if (!audit || audit.phone_score < 100) {
    tracks.push({
      id: 'ai-reception',
      title: 'AI reception coverage',
      agentType: 'reception',
      priority: 'high',
      objective: 'Capture missed calls and answer common booking questions 24/7.',
      successMetric: 'Reception config provisioned and test call completed.',
    })
  }

  if (!audit || audit.seo_score < 80) {
    tracks.push({
      id: 'seo-aeo-geo',
      title: 'Search and answer visibility',
      agentType: 'seo',
      priority: audit && audit.seo_score < 50 ? 'high' : 'medium',
      objective: 'Improve local SEO, AI answer readiness, and entity clarity.',
      successMetric: 'Metadata, schema, FAQ content, sitemap, and priority keywords published.',
    })
  }

  tracks.push({
    id: 'content-engine',
    title: 'Content and social engine',
    agentType: 'content',
    priority: 'medium',
    objective: 'Create reusable service, FAQ, image post, and carousel content from the growth plan.',
    successMetric: 'First 30-day content queue drafted for approval.',
  })

  tracks.push({
    id: 'paid-lead-engine',
    title: 'Paid lead engine',
    agentType: 'ads',
    priority: 'medium',
    objective: 'Create Google, Meta, and Instagram campaign drafts that can generate leads quickly after approval.',
    successMetric: 'Search and social campaign drafts ready with budget, targeting, keywords, and creative specs.',
  })

  tracks.push({
    id: 'analytics-loop',
    title: 'Analytics feedback loop',
    agentType: 'analytics',
    priority: 'medium',
    objective: 'Track traffic, calls, forms, rankings, and conversion signals so agents can improve strategy.',
    successMetric: 'Weekly snapshot available with recommendations for the next cycle.',
  })

  return tracks.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
}

function createTask(
  track: GrowthPlanTrack,
  workspace: GrowthWorkspace,
  audit: AuditReport | undefined,
  createdAt: string
): GrowthAgentTask {
  return {
    id: `${track.id}-${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}`,
    workspaceId: workspace.id,
    agentType: track.agentType,
    title: track.title,
    input: {
      businessName: workspace.businessName,
      websiteUrl: workspace.websiteUrl,
      industry: workspace.industry,
      city: workspace.city,
      goals: workspace.goals,
      auditId: audit?.id,
      auditScores: audit ? {
        overall: audit.overall_score,
        website: audit.website_score,
        seo: audit.seo_score,
        phone: audit.phone_score,
        booking: audit.booking_score,
      } : undefined,
    },
    status: track.priority === 'critical' ? 'needs_approval' : 'queued',
    priority: track.priority,
    requiresApproval: true,
    createdAt,
  }
}

function summarizePlan(
  workspace: GrowthWorkspace,
  audit: AuditReport | undefined,
  tracks: GrowthPlanTrack[]
): string {
  const score = audit ? `${audit.overall_score}/100 audit score` : 'no audit score yet'
  const firstTrack = tracks[0]?.title.toLowerCase() ?? 'growth setup'
  return `${workspace.businessName} needs ${firstTrack} first, based on ${score}. Default autonomy is approval-gated before publishing, outreach, ad spend, or live-site changes.`
}

function priorityRank(priority: GrowthPlanTrack['priority']): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority]
}
