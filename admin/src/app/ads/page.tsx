'use client'

import { useEffect, useState } from 'react'

interface Draft {
  id: string
  lead_id: string | null
  platform: 'google_ads' | 'meta_ads' | 'instagram_ads'
  status: string
  campaign_name: string
  objective: string
  daily_budget: number
  geo_target: { city?: string; state?: string; radiusMiles?: number }
  audience: { description: string; interests: string[]; ageRange?: string; exclusions: string[] }
  keywords: string[]
  negative_keywords: string[]
  ad_groups: Array<{ name: string; keywords: string[]; creatives: any[] }>
  creatives: Array<{
    format: string
    headlines: string[]
    descriptions: string[]
    primaryText?: string
    callToAction: string
    imagePrompts: string[]
  }>
  landing_page_url: string | null
  approval_notes: string | null
  compliance_warnings: string[]
  external_id: string | null
  published_at: string | null
  created_at: string
  lead_name: string | null
  niche: string | null
  city: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  instagram_ads: 'Instagram Ads',
}

const PLATFORM_COLORS: Record<string, string> = {
  google_ads: '#4285F4',
  meta_ads: '#1877F2',
  instagram_ads: '#E1306C',
}

const STATUS_COLORS: Record<string, string> = {
  needs_approval: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  published: '#6366f1',
  paused: '#64748b',
  draft: '#94a3b8',
}

interface PerformanceSummary {
  draft_id: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  ctr: number
  cpl: number | null
  last_synced_at: string | null
}

export default function AdsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('needs_approval')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [publishMessage, setPublishMessage] = useState<string | null>(null)
  const [performance, setPerformance] = useState<Record<string, PerformanceSummary>>({})
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  async function load(status = filter) {
    setLoading(true)
    const res = await fetch(`/api/ads/drafts?status=${status}&limit=100`)
    const data = await res.json()
    setDrafts(data.drafts ?? [])
    setLoading(false)
  }

  useEffect(() => { load(filter) }, [filter])

  async function loadPerformance(draftId: string) {
    const res = await fetch(`/api/ads/performance?draft_id=${draftId}`)
    const data = await res.json()
    if (data.summary) setPerformance(prev => ({ ...prev, [draftId]: data.summary }))
  }

  async function syncAllPerformance() {
    setSyncingAll(true)
    setSyncMessage(null)
    const res = await fetch('/api/ads/performance/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    setSyncingAll(false)
    const failed = (data.results ?? []).filter((r: any) => !r.ok)
    setSyncMessage(
      failed.length > 0
        ? `Synced with ${failed.length} error(s): ${failed.map((f: any) => f.error).join('; ')}`
        : `Synced ${data.results?.length ?? 0} published campaign(s).`
    )
    if (expanded) loadPerformance(expanded)
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    await fetch(`/api/ads/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdating(null)
    load(filter)
  }

  async function publishDraft(id: string, dryRun = false) {
    setPublishing(id)
    setPublishMessage(null)
    const res = await fetch(`/api/ads/drafts/${id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun }),
    })
    const data = await res.json()
    setPublishing(null)
    if (!res.ok || data.ok === false) {
      setPublishMessage(`Blocked: ${(data.blockers ?? ['Publishing failed']).join(' ')}`)
      return
    }
    setPublishMessage(data.mode === 'dry_run'
      ? 'Dry run passed. Live publishing remains locked until ADS_PUBLISH_LIVE=true and platform setup is complete.'
      : `Published paused campaign: ${data.externalId}`)
    load(filter)
  }

  function copyExport(draft: Draft) {
    const exported = draft.platform === 'google_ads'
      ? {
          campaign: {
            name: draft.campaign_name,
            advertisingChannelType: 'SEARCH',
            status: 'PAUSED',
            budget: { amountMicros: Math.round(draft.daily_budget * 1_000_000) },
            geoTarget: draft.geo_target,
          },
          adGroups: draft.ad_groups.map(g => ({
            name: g.name,
            keywords: g.keywords,
            ads: g.creatives.map((c: any) => ({
              headlines: c.headlines,
              descriptions: c.descriptions,
              finalUrl: draft.landing_page_url,
            })),
          })),
        }
      : {
          campaign: {
            name: draft.campaign_name,
            objective: draft.objective,
            status: 'PAUSED',
            dailyBudget: draft.daily_budget,
            geoTarget: draft.geo_target,
            audience: draft.audience,
          },
          creatives: draft.creatives.map(c => ({
            format: c.format,
            primaryText: c.primaryText,
            headlines: c.headlines,
            descriptions: c.descriptions,
            callToAction: c.callToAction,
            imagePrompts: c.imagePrompts,
            destinationUrl: draft.landing_page_url,
          })),
        }
    navigator.clipboard.writeText(JSON.stringify(exported, null, 2))
  }

  const grouped = drafts.reduce<Record<string, Draft[]>>((acc, d) => {
    const key = d.lead_id ?? 'no-lead'
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Ad Campaign Drafts</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['needs_approval', 'approved', 'published', 'rejected', 'all'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s === 'all' ? '' : s)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                background: filter === (s === 'all' ? '' : s) ? '#1e293b' : '#f1f5f9',
                color: filter === (s === 'all' ? '' : s) ? '#fff' : '#334155',
                fontWeight: 500,
              }}
            >
              {s}
            </button>
          ))}
          <button
            onClick={syncAllPerformance}
            disabled={syncingAll}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            title="Pull last 30 days of spend/clicks/conversions from Google Ads + Meta for all published campaigns"
          >
            {syncingAll ? 'Syncing…' : 'Sync Performance'}
          </button>
        </div>
      </div>

      {syncMessage && (
        <p style={{ fontSize: 12, color: syncMessage.startsWith('Synced with') ? '#b91c1c' : '#166534', marginTop: -8, marginBottom: 12 }}>
          {syncMessage}
        </p>
      )}

      {loading && <p style={{ color: '#64748b' }}>Loading…</p>}

      {!loading && Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          No ad drafts found for this filter.
        </div>
      )}

      {Object.entries(grouped).map(([leadId, leadDrafts]) => {
        const first = leadDrafts[0]
        return (
          <div key={leadId} style={{ marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{first.lead_name ?? 'Unknown Lead'}</span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{first.niche} · {first.city}</span>
              <span style={{ fontSize: 12, background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '2px 8px', marginLeft: 'auto' }}>
                {leadDrafts.length} platform{leadDrafts.length > 1 ? 's' : ''}
              </span>
            </div>

            {leadDrafts.map(draft => (
              <div key={draft.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                  onClick={() => {
                    const next = expanded === draft.id ? null : draft.id
                    setExpanded(next)
                    if (next && draft.status === 'published' && !performance[draft.id]) loadPerformance(draft.id)
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    width: 10, height: 10, borderRadius: '50%',
                    background: PLATFORM_COLORS[draft.platform] ?? '#94a3b8',
                  }} />
                  <span style={{ fontWeight: 500, fontSize: 14, minWidth: 110 }}>
                    {PLATFORM_LABELS[draft.platform]}
                  </span>
                  <span style={{ fontSize: 13, color: '#475569', flex: 1 }}>{draft.campaign_name}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>${draft.daily_budget}/day</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '2px 8px',
                    background: `${STATUS_COLORS[draft.status]}22`,
                    color: STATUS_COLORS[draft.status],
                  }}>
                    {draft.status}
                  </span>

                  {draft.compliance_warnings?.length > 0 && (
                    <span style={{ fontSize: 11, color: '#f59e0b' }}>⚠ {draft.compliance_warnings.length} warnings</span>
                  )}

                  <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                    {draft.status === 'needs_approval' && (
                      <>
                        <button
                          onClick={() => updateStatus(draft.id, 'approved')}
                          disabled={updating === draft.id}
                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(draft.id, 'rejected')}
                          disabled={updating === draft.id}
                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer' }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {draft.status === 'approved' && (
                      <>
                        <button
                          onClick={() => publishDraft(draft.id)}
                          disabled={publishing === draft.id}
                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer' }}
                          title="Publish as a paused platform campaign after validation"
                        >
                          {publishing === draft.id ? 'Publishing…' : 'Publish Paused'}
                        </button>
                        <button
                          onClick={() => publishDraft(draft.id, true)}
                          disabled={publishing === draft.id}
                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', cursor: 'pointer' }}
                        >
                          Dry Run
                        </button>
                        <button
                          onClick={() => updateStatus(draft.id, 'paused')}
                          disabled={updating === draft.id}
                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: 'none', background: '#64748b', color: '#fff', cursor: 'pointer' }}
                        >
                          Pause
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => copyExport(draft)}
                      style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
                      title="Copy platform-native export JSON"
                    >
                      Copy JSON
                    </button>
                  </div>
                </div>

                {expanded === draft.id && (
                  <div style={{ padding: '0 16px 16px', background: '#fafafa' }}>
                    {draft.status === 'published' && (
                      <div style={{ marginTop: 12, marginBottom: 4 }}>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 6px', fontWeight: 600 }}>
                          Performance (last 30 days)
                        </p>
                        {!performance[draft.id] && (
                          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
                            No synced data yet — click "Sync Performance" above.
                          </p>
                        )}
                        {performance[draft.id] && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
                            {[
                              ['Spend', `$${performance[draft.id].spend.toFixed(2)}`],
                              ['Impressions', performance[draft.id].impressions.toLocaleString()],
                              ['Clicks', performance[draft.id].clicks.toLocaleString()],
                              ['CTR', `${performance[draft.id].ctr}%`],
                              ['Leads', performance[draft.id].conversions.toString()],
                              ['Cost / Lead', performance[draft.id].cpl != null ? `$${performance[draft.id].cpl}` : '—'],
                            ].map(([label, value]) => (
                              <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
                                <p style={{ fontSize: 10, color: '#94a3b8', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</p>
                                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#1e293b' }}>{value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>Objective</p>
                        <p style={{ fontSize: 14, margin: 0 }}>{draft.objective}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>Geo Target</p>
                        <p style={{ fontSize: 14, margin: 0 }}>
                          {draft.geo_target.city}, {draft.geo_target.state} · {draft.geo_target.radiusMiles}mi
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>Audience</p>
                        <p style={{ fontSize: 13, margin: 0, color: '#374151' }}>{draft.audience.description}</p>
                        {draft.audience.interests?.length > 0 && (
                          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                            Interests: {draft.audience.interests.join(', ')}
                          </p>
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>Landing Page</p>
                        <a href={draft.landing_page_url ?? '#'} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, color: '#6366f1', wordBreak: 'break-all' }}>
                          {draft.landing_page_url ?? '—'}
                        </a>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>External Campaign</p>
                        <p style={{ fontSize: 13, margin: 0, color: '#374151', wordBreak: 'break-all' }}>
                          {draft.external_id ?? '—'}
                        </p>
                      </div>
                    </div>

                    {draft.keywords?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 6px' }}>Keywords</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {draft.keywords.map(k => (
                            <span key={k} style={{ fontSize: 12, background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '2px 8px' }}>{k}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {draft.creatives?.map((creative, i) => (
                      <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px', marginBottom: 10 }}>
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 8px', fontWeight: 600 }}>
                          CREATIVE {i + 1} — {creative.format.toUpperCase()}
                        </p>
                        {creative.primaryText && (
                          <p style={{ fontSize: 13, margin: '0 0 6px', color: '#374151' }}>{creative.primaryText}</p>
                        )}
                        <div style={{ marginBottom: 6 }}>
                          {creative.headlines.map((h, j) => (
                            <p key={j} style={{ fontSize: 13, fontWeight: 600, margin: '2px 0', color: '#1e293b' }}>• {h}</p>
                          ))}
                        </div>
                        <div>
                          {creative.descriptions.map((d, j) => (
                            <p key={j} style={{ fontSize: 12, margin: '2px 0', color: '#475569' }}>{d}</p>
                          ))}
                        </div>
                        {creative.imagePrompts?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 4px' }}>IMAGE PROMPT</p>
                            <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', margin: 0 }}>{creative.imagePrompts[0]}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    {draft.compliance_warnings?.length > 0 && (
                      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', margin: '0 0 4px' }}>Compliance Warnings</p>
                        {draft.compliance_warnings.map((w, i) => (
                          <p key={i} style={{ fontSize: 12, color: '#78350f', margin: '2px 0' }}>• {w}</p>
                        ))}
                      </div>
                    )}

                    {draft.approval_notes && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px', marginTop: 10 }}>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>Notes</p>
                        <p style={{ fontSize: 12, color: '#374151', margin: 0, whiteSpace: 'pre-wrap' }}>{draft.approval_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: '#374151' }}>Publishing</p>
        {publishMessage && (
          <p style={{ fontSize: 12, color: publishMessage.startsWith('Blocked') ? '#b91c1c' : '#166534', margin: '0 0 8px' }}>
            {publishMessage}
          </p>
        )}
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>
          <strong>Google Ads:</strong> Approved drafts can be dry-run or published as paused Search campaigns after OAuth, customer ID, developer token, conversion tracking, and budget caps are configured.
        </p>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          <strong>Meta/Instagram:</strong> Approved drafts can create paused campaign shells after Meta OAuth and ad account setup. Ad set and creative activation stays gated until pixel/page/assets are verified.
        </p>
      </div>
    </div>
  )
}
