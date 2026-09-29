'use client'

import { useEffect, useState } from 'react'

interface Workspace {
  id: string
  business_name: string
}

interface ContentPlan {
  id: string
  workspace_id: string
  business_name: string
  tier: 'weekly_lite' | 'daily_premium'
  channels: string[]
  reels_per_period: number
  carousels_per_period: number
  images_per_period: number
  period: string
  active: boolean
  last_generated_at: string | null
}

const ALL_CHANNELS = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x']

const TIER_LABELS: Record<string, string> = {
  weekly_lite: 'Weekly Lite — 1 reel + 1 carousel + 2 images / week',
  daily_premium: 'Daily Premium — 3 reels + 1 carousel / day',
}

export default function ContentPlansPage() {
  const [plans, setPlans] = useState<ContentPlan[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [tier, setTier] = useState<'weekly_lite' | 'daily_premium'>('weekly_lite')
  const [channels, setChannels] = useState<string[]>(['instagram', 'facebook'])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const [plansRes, wsRes] = await Promise.all([
      fetch('/api/content-plans'),
      fetch('/api/platform/workspaces'),
    ])
    const plansData = await plansRes.json()
    const wsData = await wsRes.json()
    setPlans(plansData.plans ?? [])
    setWorkspaces(wsData.workspaces ?? [])
  }

  useEffect(() => { load() }, [])

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function save() {
    if (!workspaceId) { setMessage('Pick a workspace first.'); return }
    setBusy(true)
    setMessage(null)
    const res = await fetch('/api/content-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, tier, channels }),
    })
    setBusy(false)
    if (!res.ok) { setMessage('Save failed.'); return }
    setMessage('Content plan saved. Next content-cadence-cron run will pick it up.')
    load()
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', margin: 0 }}>
        Social Content Plans
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4, marginBottom: 20 }}>
        Assigns each client a reel/carousel cadence tier. content-cadence-cron.ts generates drafts on this schedule; nothing renders or posts until a human approves each item in the Video/Social queues.
      </p>

      <section style={{ ...panel, padding: 18, marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={label}>
            Workspace
            <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} style={selectStyle}>
              <option value="">Select a client...</option>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.business_name}</option>)}
            </select>
          </label>

          <label style={label}>
            Tier
            <select value={tier} onChange={(e) => setTier(e.target.value as any)} style={selectStyle}>
              {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>

          <div>
            <div style={{ ...label, marginBottom: 8 }}>Channels</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ALL_CHANNELS.map((c) => (
                <button key={c} onClick={() => toggleChannel(c)} style={chip(channels.includes(c))}>{c}</button>
              ))}
            </div>
          </div>

          <button disabled={busy} onClick={save} style={saveButton}>{busy ? 'Saving...' : 'Save Plan'}</button>
          {message && <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{message}</div>}
        </div>
      </section>

      <section style={panel}>
        {plans.length === 0 && <div style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>No content plans yet.</div>}
        {plans.map((p, i) => (
          <div key={p.id} style={{ padding: '14px 16px', borderBottom: i < plans.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{p.business_name}</div>
              <span style={{ fontSize: 11, fontWeight: 800, color: p.active ? 'var(--success)' : 'var(--muted)' }}>{p.active ? 'ACTIVE' : 'PAUSED'}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
              {TIER_LABELS[p.tier]} · {p.channels.join(', ')} · last generated {p.last_generated_at ? new Date(p.last_generated_at).toLocaleDateString() : 'never'}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

const panel: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 }
const selectStyle: React.CSSProperties = { minHeight: 36, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', padding: '0 10px', fontSize: 13, fontWeight: 600 }
const saveButton: React.CSSProperties = { minHeight: 38, borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: 'var(--accent-dim-2)', color: 'var(--accent-light)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }
function chip(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 999,
    border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border)',
    background: active ? 'var(--accent-dim-2)' : 'var(--surface)',
    color: active ? 'var(--accent-light)' : 'var(--text-2)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  }
}
