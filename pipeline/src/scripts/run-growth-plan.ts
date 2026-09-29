/**
 * run-growth-plan.ts
 *
 * Creates an AI Growth OS plan from an existing audit.
 *
 * Usage:
 *   AUDIT_ID=<uuid> npx tsx src/scripts/run-growth-plan.ts
 *   AUDIT_ID=<uuid> GROWTH_PLAN_DRY_RUN=true npx tsx src/scripts/run-growth-plan.ts
 */

import 'dotenv/config'
import { createGrowthPlan, createGrowthWorkspace } from '../growth/brain.js'
import { loadAuditReport, saveGrowthPlanBundle } from '../growth/db.js'
import { saveMemoryDocument } from '../memory/index.js'
import { createSocialAssetDrafts, saveSocialAssetDrafts } from '../social/index.js'
import { createAdCampaignDrafts, saveAdCampaignDrafts } from '../ads/index.js'
import { createVideoAssetDrafts, saveVideoAssetDrafts } from '../video/assets.js'

const auditId = process.env.AUDIT_ID
const dryRun = process.env.GROWTH_PLAN_DRY_RUN === 'true'

if (!auditId) {
  console.error('[run-growth-plan] AUDIT_ID env var required')
  process.exit(1)
}

const audit = await loadAuditReport(auditId)
if (!audit) {
  console.error(`[run-growth-plan] Audit not found: ${auditId}`)
  process.exit(1)
}

const workspace = createGrowthWorkspace({ audit })
const plan = createGrowthPlan({ workspace, audit })

console.log(`[run-growth-plan] ${plan.businessName}`)
console.log(`  Website: ${plan.websiteUrl}`)
console.log(`  Priority: ${plan.priority}`)
console.log(`  Summary: ${plan.summary}`)
console.log('\n  Tracks:')
for (const track of plan.tracks) {
  console.log(`  - [${track.priority}] ${track.title} (${track.agentType})`)
}

if (dryRun) {
  console.log('\nDry run only. Plan JSON:')
  console.log(JSON.stringify(plan, null, 2))
  process.exit(0)
}

const saved = await saveGrowthPlanBundle(workspace, plan, audit.id, audit.lead_id)

const memory = await saveMemoryDocument({
  workspaceId: saved.workspaceId,
  leadId: audit.lead_id,
  sourceType: 'audit',
  sourceUrl: audit.website_url,
  title: `${audit.business_name} AI Growth Audit`,
  content: [
    plan.summary,
    `Overall score: ${audit.overall_score}/100`,
    `Website score: ${audit.website_score}/100`,
    `SEO score: ${audit.seo_score}/100`,
    `Phone score: ${audit.phone_score}/100`,
    `Booking score: ${audit.booking_score}/100`,
    `Issues: ${[...audit.site_issues, ...audit.seo_issues].join('; ')}`,
    `Recommendations: ${audit.recommendations.map((r) => `${r.title}: ${r.description}`).join('; ')}`,
  ].filter(Boolean).join('\n'),
  metadata: {
    auditId: audit.id,
    planId: saved.planId,
    source: 'run-growth-plan',
  },
})

const socialDrafts = createSocialAssetDrafts({
  audit,
  plan: { ...plan, workspaceId: saved.workspaceId },
  workspaceId: saved.workspaceId,
})
const socialIds = await saveSocialAssetDrafts(socialDrafts)

const adDrafts = createAdCampaignDrafts({
  audit,
  plan: { ...plan, workspaceId: saved.workspaceId },
  workspaceId: saved.workspaceId,
})
const adIds = await saveAdCampaignDrafts(adDrafts)

const videoDrafts = createVideoAssetDrafts({
  audit,
  plan: { ...plan, workspaceId: saved.workspaceId },
  workspaceId: saved.workspaceId,
})
const videoIds = await saveVideoAssetDrafts(videoDrafts)

console.log('\nSaved Growth OS plan:')
console.log(`  Workspace: ${saved.workspaceId}`)
console.log(`  Plan:      ${saved.planId}`)
console.log(`  Tasks:     ${saved.taskIds.length}`)
console.log(`  Memory:    ${memory.chunkIds.length} chunks`)
console.log(`  Social:    ${socialIds.length} drafts`)
console.log(`  Ads:       ${adIds.length} drafts`)
console.log(`  Video:     ${videoIds.length} drafts`)
