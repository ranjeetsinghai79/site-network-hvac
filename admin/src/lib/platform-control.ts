import { Pool } from '@/lib/pool'
import { randomHex, sha256Hex } from '@/lib/edge-crypto'
import type { PlatformRole } from '@/lib/platform-session'

let _pool: InstanceType<typeof Pool> | null = null
export function platformPool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

export async function defaultAgencyId(): Promise<string> {
  const { rows } = await platformPool().query(`SELECT id FROM agency_accounts WHERE slug='webcrew' LIMIT 1`)
  if (!rows[0]) throw new Error('Default agency is not configured')
  return rows[0].id
}

export function safeWebsiteUrl(raw: string): string {
  let value = raw.trim()
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public HTTP(S) URLs are allowed')
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const blocked = host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' || host === '::1' ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (blocked) throw new Error('Private or local URLs are not allowed')
  url.hash = ''
  return url.toString()
}

function inferNiche(text: string, requested?: string): string {
  if (requested?.trim()) return requested.trim().toLowerCase()
  const source = text.toLowerCase()
  const rules: Array<[string, RegExp]> = [
    ['hvac', /hvac|air conditioning|heating and cooling|furnace/],
    ['medspa', /med spa|medspa|botox|aesthetic|injectable/],
    ['dental', /dentist|dental|orthodont/],
    ['roofing', /roofing|roof repair|roofer/],
    ['plumbing', /plumb|drain cleaning|water heater/],
    ['attorney', /attorney|law firm|legal services/],
    ['restaurant', /restaurant|menu|dining|catering/],
    ['realtor', /realtor|real estate|homes for sale/],
  ]
  return rules.find(([, pattern]) => pattern.test(source))?.[0] ?? 'local_business'
}

function buildDna(url: string, markdown: string, requestedNiche?: string) {
  const lines = markdown.split('\n').map((line) => line.trim()).filter(Boolean)
  const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#+\s*/, '') || new URL(url).hostname.replace(/^www\./, '')
  const services = lines
    .filter((line) => /^[-*]\s+/.test(line) || /^#{2,3}\s+/.test(line))
    .map((line) => line.replace(/^[-*#\s]+/, '').replace(/\*+/g, '').trim())
    .filter((line) => line.length >= 3 && line.length <= 90)
    .slice(0, 12)
  const phones = Array.from(new Set(markdown.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) ?? [])).slice(0, 3)
  const emails = Array.from(new Set(markdown.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])).slice(0, 3)
  const niche = inferNiche(markdown, requestedNiche)
  return {
    businessName: title.slice(0, 160),
    niche,
    services,
    phones,
    emails,
    signals: {
      hasBooking: /book|schedule|appointment/i.test(markdown),
      hasReviews: /review|testimonial|five star|5-star/i.test(markdown),
      hasPricing: /pricing|price|cost|\$\d/i.test(markdown),
      hasChat: /live chat|chat now|message us/i.test(markdown),
    },
    sourceCharacters: markdown.length,
    sourceUrl: url,
    capturedAt: new Date().toISOString(),
  }
}

async function crawlForDna(url: string): Promise<string> {
  const base = process.env.FIRECRAWL_URL
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (base && apiKey) {
    const response = await fetch(`${base.replace(/\/$/, '')}/v1/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
      signal: AbortSignal.timeout(45_000),
    })
    if (response.ok) {
      const data = await response.json() as any
      const markdown = data.data?.markdown ?? data.data?.content
      if (typeof markdown === 'string' && markdown.trim()) return markdown.slice(0, 100_000)
    }
  }
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'WebCrewBusinessDNA/1.0' } })
  if (!response.ok) throw new Error(`Website returned ${response.status}`)
  const html = (await response.text()).slice(0, 500_000)
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

function requiredIntegrations(agentIds: string[]): string[] {
  const required = new Set<string>()
  if (agentIds.includes('paid-growth')) ['google_ads', 'meta_ads'].forEach((value) => required.add(value))
  if (agentIds.includes('content-studio')) ['facebook_page', 'instagram'].forEach((value) => required.add(value))
  if (agentIds.includes('ai-receptionist') || agentIds.includes('lead-follow-up')) required.add('twilio')
  if (agentIds.includes('seo-growth') || agentIds.includes('reputation-manager')) required.add('google_business_profile')
  return [...required]
}

export async function createOnboarding(params: { agencyId: string; actorEmail: string; websiteUrl: string; niche?: string }) {
  const websiteUrl = safeWebsiteUrl(params.websiteUrl)
  const markdown = await crawlForDna(websiteUrl)
  const dna = buildDna(websiteUrl, markdown, params.niche)
  const { rows: playbooks } = await platformPool().query(`
    SELECT id, definition FROM playbook_templates
    WHERE status='active' ORDER BY CASE WHEN niche=$1 THEN 0 ELSE 1 END, created_at LIMIT 1
  `, [dna.niche])
  const playbook = playbooks[0]
  const agentIds = Array.isArray(playbook?.definition?.agents) ? playbook.definition.agents : ['business-intelligence', 'business-manager']
  const integrationNames = requiredIntegrations(agentIds)
  const blockers = integrationNames.map((provider) => ({ provider, status: 'not_connected' }))
  const { rows } = await platformPool().query(`
    INSERT INTO onboarding_sessions (agency_id, created_by, website_url, status, business_dna, selected_playbook_id, integration_blockers)
    VALUES ($1,$2,$3,'review',$4,$5,$6) RETURNING *
  `, [params.agencyId, params.actorEmail, websiteUrl, JSON.stringify(dna), playbook?.id ?? null, JSON.stringify(blockers)])
  await auditPlatform({ agencyId: params.agencyId, actorEmail: params.actorEmail, action: 'onboarding.created', entityType: 'onboarding_session', entityId: rows[0].id, metadata: { websiteUrl } })
  return rows[0]
}

export async function confirmOnboarding(params: { agencyId: string; actorEmail: string; onboardingId: string; playbookId?: string; serviceTier?: string }) {
  const client = await platformPool().connect()
  try {
    await client.query('BEGIN')
    const { rows: sessions } = await client.query(`SELECT * FROM onboarding_sessions WHERE id=$1 AND agency_id=$2 FOR UPDATE`, [params.onboardingId, params.agencyId])
    const session = sessions[0]
    if (!session) throw new Error('Onboarding session not found')
    if (session.workspace_id) {
      await client.query('COMMIT')
      return { workspaceId: session.workspace_id, reused: true }
    }
    const dna = session.business_dna ?? {}
    const playbookId = params.playbookId ?? session.selected_playbook_id
    const { rows: workspaces } = await client.query(`
      INSERT INTO growth_workspaces (agency_id, business_name, website_url, industry, goals, autonomy_level, lifecycle_stage, service_tier, onboarding_status)
      VALUES ($1,$2,$3,$4,$5,1,'onboarding',$6,$7) RETURNING id
    `, [params.agencyId, dna.businessName ?? new URL(session.website_url).hostname, session.website_url, dna.niche ?? null, JSON.stringify(['capture_leads', 'book_appointments', 'grow_revenue']), params.serviceTier ?? 'managed', JSON.stringify({ dnaReviewed: true, integrations: session.integration_blockers })])
    const workspaceId = workspaces[0].id
    if (playbookId) {
      await client.query(`INSERT INTO workspace_playbook_installations (workspace_id, playbook_id, installed_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [workspaceId, playbookId, params.actorEmail])
      const { rows: definitions } = await client.query(`SELECT definition FROM playbook_templates WHERE id=$1`, [playbookId])
      const agents = Array.isArray(definitions[0]?.definition?.agents) ? definitions[0].definition.agents : []
      for (const agentId of agents) {
        await client.query(`
          INSERT INTO workspace_agent_installations (workspace_id, agent_id, enabled, autonomy_level, installed_by)
          SELECT $1, id, true, CASE WHEN risk_level='low' THEN 2 ELSE 1 END, $3 FROM agent_definitions WHERE id=$2
          ON CONFLICT (workspace_id, agent_id) DO NOTHING
        `, [workspaceId, agentId, params.actorEmail])
      }
      for (const provider of requiredIntegrations(agents)) {
        await client.query(`
          INSERT INTO workspace_integrations (agency_id,workspace_id,provider,status)
          VALUES ($1,$2,$3,'not_connected') ON CONFLICT (workspace_id,provider) DO NOTHING
        `, [params.agencyId, workspaceId, provider])
      }
    }
    const content = JSON.stringify(dna, null, 2)
    const { rows: docs } = await client.query(`
      INSERT INTO memory_documents (workspace_id, source_type, source_url, title, content, metadata)
      VALUES ($1,'website_dna',$2,$3,$4,$5) RETURNING id
    `, [workspaceId, session.website_url, `${dna.businessName ?? 'Business'} DNA`, content, JSON.stringify({ onboardingId: session.id })])
    await client.query(`INSERT INTO memory_chunks (document_id, workspace_id, chunk_index, content, keywords, metadata) VALUES ($1,$2,0,$3,$4,$5)`, [docs[0].id, workspaceId, content, [dna.niche ?? 'business'], JSON.stringify({ source: 'onboarding' })])
    await client.query(`UPDATE onboarding_sessions SET status='completed', workspace_id=$2, updated_at=now() WHERE id=$1`, [session.id, workspaceId])
    await client.query(`
      INSERT INTO automation_schedules (workspace_id,agent_id,trigger_type,interval_minutes,requires_approval,input,next_run_at,created_by)
      SELECT $1,'business-manager','daily_business_manager',1440,false,'{}',now()+interval '1 day',$2
      WHERE EXISTS (SELECT 1 FROM workspace_agent_installations WHERE workspace_id=$1 AND agent_id='business-manager' AND enabled)
      ON CONFLICT (workspace_id,agent_id,trigger_type) DO NOTHING
    `, [workspaceId, params.actorEmail])
    await client.query(`
      INSERT INTO automation_schedules (workspace_id,agent_id,trigger_type,interval_minutes,requires_approval,input,next_run_at,created_by)
      SELECT $1,'business-manager','weekly_outcome_report',10080,false,'{"period":"7d"}',now()+interval '7 days',$2
      WHERE EXISTS (SELECT 1 FROM workspace_agent_installations WHERE workspace_id=$1 AND agent_id='business-manager' AND enabled)
      ON CONFLICT (workspace_id,agent_id,trigger_type) DO NOTHING
    `, [workspaceId, params.actorEmail])
    await client.query('COMMIT')
    await auditPlatform({ agencyId: params.agencyId, workspaceId, actorEmail: params.actorEmail, action: 'workspace.provisioned', entityType: 'workspace', entityId: workspaceId, metadata: { onboardingId: session.id, playbookId } })
    return { workspaceId, reused: false }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function createInvite(params: { agencyId: string; actorEmail: string; email: string; role: PlatformRole; preserveMemberStatus?: boolean }) {
  const token = randomHex(32)
  const hash = await sha256Hex(token)
  await platformPool().query(`
    INSERT INTO agency_members (agency_id,email,role,status,invited_by)
    VALUES ($1,lower($2),$3,$5,$4)
    ON CONFLICT (agency_id,email) DO UPDATE SET role=EXCLUDED.role,status=CASE WHEN $6 THEN agency_members.status ELSE 'invited' END,invited_by=EXCLUDED.invited_by,updated_at=now()
  `, [params.agencyId, params.email, params.role, params.actorEmail, params.preserveMemberStatus ? 'active' : 'invited', Boolean(params.preserveMemberStatus)])
  const { rows } = await platformPool().query(`
    INSERT INTO platform_invites (agency_id,email,role,token_hash,invited_by,expires_at)
    VALUES ($1,lower($2),$3,$4,$5,now()+interval '7 days') RETURNING id,expires_at
  `, [params.agencyId, params.email, params.role, hash, params.actorEmail])
  await auditPlatform({ agencyId: params.agencyId, actorEmail: params.actorEmail, action: 'member.invited', entityType: 'agency_member', entityId: params.email, metadata: { role: params.role } })
  return { ...rows[0], token }
}

export async function auditPlatform(params: { agencyId?: string; workspaceId?: string; actorEmail?: string; actorRole?: string; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> }) {
  await platformPool().query(`
    INSERT INTO security_audit_log (agency_id,workspace_id,actor_email,actor_role,action,entity_type,entity_id,metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  `, [params.agencyId ?? null, params.workspaceId ?? null, params.actorEmail ?? null, params.actorRole ?? null, params.action, params.entityType, params.entityId ?? null, JSON.stringify(params.metadata ?? {})])
}

export async function checkRateLimit(scope: string, action: string, limit: number, windowMinutes = 1): Promise<boolean> {
  const window = new Date(Math.floor(Date.now() / (windowMinutes * 60_000)) * windowMinutes * 60_000)
  const { rows } = await platformPool().query(`
    INSERT INTO platform_rate_limits (scope_key,action,window_start,request_count)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (scope_key,action,window_start) DO UPDATE SET request_count=platform_rate_limits.request_count+1,updated_at=now()
    RETURNING request_count
  `, [scope, action, window.toISOString()])
  return Number(rows[0].request_count) <= limit
}
