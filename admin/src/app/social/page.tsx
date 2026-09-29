'use client'

import { useEffect, useState } from 'react'

interface SocialAsset {
  id: string
  platform: string
  asset_type: string
  status: string
  title: string
  caption: string
  hashtags: string[]
  slides: Array<{ title: string; body: string }>
  image_prompts: string[]
  compliance_warnings: string[]
  external_id: string | null
  asset_url: string | null
  publish_error: string | null
  business_name: string | null
  created_at: string
}

const LABELS: Record<string, string> = {
  google_business_profile: 'Google Business',
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  x: 'X',
  youtube: 'YouTube',
  nextdoor: 'Nextdoor',
}

const STATUS_COLORS: Record<string, string> = {
  needs_approval: '#f59e0b',
  approved: '#10b981',
  published: '#6366f1',
  scheduled: '#0ea5e9',
  rejected: '#ef4444',
  draft: '#94a3b8',
}

export default function SocialPage() {
  const [assets, setAssets] = useState<SocialAsset[]>([])
  const [filter, setFilter] = useState('needs_approval')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load(status = filter) {
    const qs = status ? `?status=${status}&limit=150` : '?limit=150'
    const res = await fetch(`/api/social/assets${qs}`)
    const data = await res.json()
    setAssets(data.assets ?? [])
  }

  useEffect(() => { load(filter) }, [filter])

  async function updateStatus(id: string, status: string) {
    setBusy(id)
    setMessage(null)
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'social',
        entityId: id,
        action: status === 'approved' ? 'approve' : 'reject',
        actorEmail: 'admin@webcrew.app',
        notes: `Social ${status} from Social Queue`,
      }),
    })
    setBusy(null)
    if (!res.ok) {
      setMessage('Status update failed.')
      return
    }
    load(filter)
  }

  async function publish(id: string, dryRun = false) {
    setBusy(id)
    setMessage(null)
    const res = await fetch(`/api/social/assets/${id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun }),
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok || data.ok === false) {
      setMessage(`Blocked: ${(data.blockers ?? ['Publishing failed']).join(' ')}`)
      return
    }
    if (data.mode === 'manual_handoff') {
      setMessage(`Handoff ready: ${(data.warnings ?? ['Use the generated package for manual publishing.']).join(' ')}`)
    } else if (data.mode === 'dry_run') {
      setMessage('Dry run passed. Live publishing remains locked until SOCIAL_PUBLISH_LIVE=true and platform setup is complete.')
    } else {
      setMessage(`Published: ${data.externalId}`)
    }
    load(filter)
  }

  function copyPackage(asset: SocialAsset) {
    navigator.clipboard.writeText(JSON.stringify({
      platform: asset.platform,
      assetType: asset.asset_type,
      title: asset.title,
      caption: asset.caption,
      hashtags: asset.hashtags,
      slides: asset.slides,
      imagePrompts: asset.image_prompts,
      assetUrl: asset.asset_url,
    }, null, 2))
    setMessage('Handoff package copied.')
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', margin: 0 }}>
            Social Content Queue
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            Approval-gated posts, carousels, dry runs, live API publishing, and handoff packages.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {['needs_approval', 'approved', 'published', 'rejected', 'all'].map((s) => (
            <button key={s} onClick={() => setFilter(s === 'all' ? '' : s)} style={tab(filter === (s === 'all' ? '' : s))}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', color: message.startsWith('Blocked') ? '#fca5a5' : 'var(--success)', background: 'var(--surface)' }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>{message}</span>
        </div>
      )}

      <section style={panel}>
        {assets.length === 0 && (
          <div style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>No social assets for this filter.</div>
        )}
        {assets.map((asset, i) => (
          <div key={asset.id} style={{ borderBottom: i < assets.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <button onClick={() => setOpen(open === asset.id ? null : asset.id)} style={rowButton}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#334155', borderRadius: 5, padding: '2px 7px' }}>
                    {LABELS[asset.platform] ?? asset.platform}
                  </span>
                  <span style={{ fontSize: 11, color: STATUS_COLORS[asset.status] ?? '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                    {asset.status}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{asset.asset_type}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {asset.title}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                  {asset.business_name ?? 'Unknown business'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                {asset.status === 'needs_approval' && (
                  <>
                    <button disabled={busy === asset.id} onClick={() => updateStatus(asset.id, 'approved')} style={actionButton('#10b981')}>Approve</button>
                    <button disabled={busy === asset.id} onClick={() => updateStatus(asset.id, 'rejected')} style={actionButton('#ef4444')}>Reject</button>
                  </>
                )}
                {asset.status === 'approved' && (
                  <>
                    <button disabled={busy === asset.id} onClick={() => publish(asset.id)} style={actionButton('#6366f1')}>
                      {busy === asset.id ? 'Working...' : 'Publish/Handoff'}
                    </button>
                    <button disabled={busy === asset.id} onClick={() => publish(asset.id, true)} style={actionButton('#0ea5e9')}>Dry Run</button>
                  </>
                )}
                <button onClick={() => copyPackage(asset)} style={actionButton('#64748b')}>Copy</button>
              </div>
            </button>

            {open === asset.id && (
              <div style={{ padding: '0 16px 16px', background: 'var(--surface-2)' }}>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)', whiteSpace: 'pre-wrap', margin: '12px 0' }}>
                  {asset.caption}
                </p>
                {asset.hashtags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {asset.hashtags.map((tag) => <span key={tag} style={pill}>{tag}</span>)}
                  </div>
                )}
                {asset.slides?.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
                    {asset.slides.map((slide, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface)' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{slide.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>{slide.body}</div>
                      </div>
                    ))}
                  </div>
                )}
                {asset.image_prompts?.slice(0, 2).map((prompt) => (
                  <div key={prompt} style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                    Image prompt: {prompt}
                  </div>
                ))}
                {asset.publish_error && (
                  <div style={{ fontSize: 11.5, color: '#fca5a5', marginTop: 10 }}>{asset.publish_error}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}

function tab(active: boolean): React.CSSProperties {
  return {
    padding: '7px 12px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: active ? 'var(--accent-dim-2)' : 'var(--surface)',
    color: active ? 'var(--accent-light)' : 'var(--text-2)',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  }
}

function actionButton(color: string): React.CSSProperties {
  return {
    minHeight: 30,
    borderRadius: 7,
    border: `1px solid ${color}55`,
    background: `${color}18`,
    color,
    padding: '0 9px',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
  }
}

const panel: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const rowButton: React.CSSProperties = { width: '100%', display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }
const pill: React.CSSProperties = { fontSize: 11, color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 999, padding: '3px 8px', background: 'var(--accent-dim-2)' }
