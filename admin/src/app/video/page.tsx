'use client'

import { useEffect, useState } from 'react'

interface VideoAsset {
  id: string
  platform: string
  provider: string
  status: string
  title: string
  script: string
  scenes: Array<{ title: string; narration: string; visualPrompt: string; durationSec: number }>
  prompt: string
  duration_sec: number
  aspect_ratio: string
  compliance_warnings: string[]
  render_error: string | null
  external_job_id: string | null
  asset_url: string | null
  business_name: string | null
}

const STATUS_COLORS: Record<string, string> = {
  needs_approval: '#f59e0b',
  approved: '#10b981',
  rendering: '#0ea5e9',
  rendered: '#6366f1',
  published: '#8b5cf6',
  failed: '#ef4444',
  rejected: '#ef4444',
}

export default function VideoPage() {
  const [assets, setAssets] = useState<VideoAsset[]>([])
  const [filter, setFilter] = useState('needs_approval')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [provider, setProvider] = useState<'fal_kling' | 'runpod' | 'gcp_veo' | 'hyperframes' | 'manual'>('fal_kling')

  async function load(status = filter) {
    const qs = status ? `?status=${status}&limit=150` : '?limit=150'
    const res = await fetch(`/api/video/assets${qs}`)
    const data = await res.json()
    setAssets(data.assets ?? [])
  }

  useEffect(() => { load(filter) }, [filter])

  async function approve(id: string, action: 'approve' | 'reject') {
    setBusy(id)
    setMessage(null)
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'video',
        entityId: id,
        action,
        actorEmail: 'admin@webcrew.app',
        notes: `Video ${action} from Video Queue`,
      }),
    })
    setBusy(null)
    if (!res.ok) {
      setMessage('Approval update failed.')
      return
    }
    load(filter)
  }

  async function publish(id: string, dryRun = false) {
    setBusy(id)
    setMessage(null)
    const res = await fetch(`/api/video/assets/${id}/publish`, {
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
      setMessage(`Handoff ready: ${(data.warnings ?? ['Use the rendered asset for manual publishing.']).join(' ')}`)
    } else if (data.mode === 'dry_run') {
      setMessage('Dry run passed. Live publishing remains locked until VIDEO_PUBLISH_LIVE=true.')
    } else {
      setMessage(`Published: ${data.externalId}`)
    }
    load(filter)
  }

  async function generate(id: string, dryRun = false) {
    setBusy(id)
    setMessage(null)
    const res = await fetch(`/api/video/assets/${id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, dryRun }),
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok || data.ok === false) {
      setMessage(`Blocked: ${(data.blockers ?? ['Generation failed']).join(' ')}`)
      return
    }
    if (data.mode === 'manual_handoff') {
      setMessage(`Handoff ready: ${(data.warnings ?? ['Manual package generated.']).join(' ')}`)
    } else if (data.mode === 'dry_run') {
      setMessage('Dry run passed. Live generation remains locked until VIDEO_GENERATION_LIVE=true.')
    } else {
      setMessage(`Generation submitted: ${data.externalJobId ?? data.assetUrl}`)
    }
    load(filter)
  }

  function copyPackage(asset: VideoAsset) {
    navigator.clipboard.writeText(JSON.stringify({
      title: asset.title,
      platform: asset.platform,
      provider,
      durationSec: asset.duration_sec,
      aspectRatio: asset.aspect_ratio,
      script: asset.script,
      scenes: asset.scenes,
      prompt: asset.prompt,
    }, null, 2))
    setMessage('Video package copied.')
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', margin: 0 }}>
            Video Queue
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            Phase-two video drafts, approvals, RunPod/GCP submissions, Hyperframes packages, and manual handoff.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select value={provider} onChange={(e) => setProvider(e.target.value as any)} style={selectStyle}>
            <option value="fal_kling">fal.ai / Kling (reels, native audio)</option>
            <option value="runpod">RunPod</option>
            <option value="gcp_veo">GCP/Veo</option>
            <option value="hyperframes">Hyperframes</option>
            <option value="manual">Manual</option>
          </select>
          {['needs_approval', 'approved', 'rendering', 'rendered', 'failed', 'all'].map((s) => (
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
        {assets.length === 0 && <div style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>No video assets for this filter.</div>}
        {assets.map((asset, i) => (
          <div key={asset.id} style={{ borderBottom: i < assets.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <button onClick={() => setOpen(open === asset.id ? null : asset.id)} style={rowButton}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={pill}>{asset.platform}</span>
                  <span style={{ fontSize: 11, color: STATUS_COLORS[asset.status] ?? '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>{asset.status}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{asset.duration_sec}s · {asset.aspect_ratio}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{asset.business_name ?? 'Unknown business'}</div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                {asset.status === 'needs_approval' && (
                  <>
                    <button disabled={busy === asset.id} onClick={() => approve(asset.id, 'approve')} style={actionButton('#10b981')}>Approve</button>
                    <button disabled={busy === asset.id} onClick={() => approve(asset.id, 'reject')} style={actionButton('#ef4444')}>Reject</button>
                  </>
                )}
                {asset.status === 'approved' && (
                  <>
                    <button disabled={busy === asset.id} onClick={() => generate(asset.id)} style={actionButton('#6366f1')}>{busy === asset.id ? 'Working...' : 'Generate'}</button>
                    <button disabled={busy === asset.id} onClick={() => generate(asset.id, true)} style={actionButton('#0ea5e9')}>Dry Run</button>
                  </>
                )}
                {asset.status === 'rendered' && (
                  <>
                    <button disabled={busy === asset.id} onClick={() => publish(asset.id)} style={actionButton('#8b5cf6')}>{busy === asset.id ? 'Working...' : 'Publish/Handoff'}</button>
                    <button disabled={busy === asset.id} onClick={() => publish(asset.id, true)} style={actionButton('#0ea5e9')}>Dry Run</button>
                  </>
                )}
                <button onClick={() => copyPackage(asset)} style={actionButton('#64748b')}>Copy</button>
              </div>
            </button>

            {open === asset.id && (
              <div style={{ padding: '0 16px 16px', background: 'var(--surface-2)' }}>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)', whiteSpace: 'pre-wrap', margin: '12px 0' }}>{asset.script}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
                  {asset.scenes?.map((scene, idx) => (
                    <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface)' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{scene.title} · {scene.durationSec}s</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>{scene.narration}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>Prompt: {asset.prompt}</div>
                {asset.external_job_id && <div style={{ fontSize: 11.5, color: 'var(--info)', marginTop: 8 }}>Job: {asset.external_job_id}</div>}
                {asset.asset_url && (
                  <video controls src={asset.asset_url} style={{ display: 'block', maxWidth: 280, borderRadius: 8, marginTop: 10 }} />
                )}
                {asset.asset_url && <a href={asset.asset_url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 11.5, color: 'var(--accent-light)', marginTop: 8 }}>Open rendered asset</a>}
                {asset.render_error && <div style={{ fontSize: 11.5, color: '#fca5a5', marginTop: 8 }}>{asset.render_error}</div>}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}

function tab(active: boolean): React.CSSProperties {
  return { padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', background: active ? 'var(--accent-dim-2)' : 'var(--surface)', color: active ? 'var(--accent-light)' : 'var(--text-2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }
}

function actionButton(color: string): React.CSSProperties {
  return { minHeight: 30, borderRadius: 7, border: `1px solid ${color}55`, background: `${color}18`, color, padding: '0 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }
}

const selectStyle: React.CSSProperties = { minHeight: 34, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', padding: '0 10px', fontSize: 12, fontWeight: 800 }
const panel: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const rowButton: React.CSSProperties = { width: '100%', display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }
const pill: React.CSSProperties = { fontSize: 11, color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 999, padding: '3px 8px', background: 'var(--accent-dim-2)' }
