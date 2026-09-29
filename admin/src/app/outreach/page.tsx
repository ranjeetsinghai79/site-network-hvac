'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  MessageSquare, Mail, Phone, TrendingUp,
  Clock, CheckCircle2, XCircle, AlertCircle,
  ExternalLink, RefreshCw,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutreachLead {
  id: string
  name: string
  niche: string
  city: string
  state: string
  phone: string | null
  email: string | null
  tier: string | null
  status: string
  outreach_sent: boolean
  outreach_sent_at: string | null
  sms_sent: boolean
  sms_sent_at: string | null
  vercel_url: string | null
  cloudflare_url: string | null
  follow_up_1_sent_at: string | null
  follow_up_2_sent_at: string | null
}

interface TwilioStatus {
  status: string      // sent | delivered | read | failed | undelivered
  date_sent: string
  sid: string
  error_code: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NICHE_EMOJI: Record<string, string> = {
  hvac: '❄️', 'auto-detailing': '🚗', cleaning: '🧹', lawfirm: '⚖️',
  medspa: '💆', dentist: '🦷', roofing: '🏠', plumbing: '🔧',
  restaurant: '🍽️', salon: '💇', barbershop: '✂️', nailstudio: '💅',
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  delivered:   { color: '#22c55e', label: 'Delivered' },
  sent:        { color: '#3b82f6', label: 'Sent' },
  read:        { color: '#8b5cf6', label: 'Read' },
  failed:      { color: '#ef4444', label: 'Failed' },
  undelivered: { color: '#f59e0b', label: 'Undelivered' },
  unknown:     { color: '#64748b', label: 'Unknown' },
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPhone(p: string | null) {
  if (!p) return '—'
  const d = p.replace(/\D/g, '').slice(-10)
  return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : p
}

function normalisePhone(p: string | null): string {
  if (!p) return ''
  return p.replace(/\D/g, '').slice(-10)
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: any
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ background: color + '22', borderRadius: 8, padding: 6, display: 'flex' }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{sub}</div>}
    </div>
  )
}

// ─── Live Conversations (Sofia SMS agent) ────────────────────────────────────

interface SmsConversation {
  phone: string
  stage: string
  demo_url: string | null
  offered_price: number | null
  last_message: string | null
  last_reply: string | null
  messages: Array<{ role: 'user' | 'model'; text: string }>
  updated_at: string
  lead_name: string | null
  lead_niche: string | null
  lead_city: string | null
  build_status: string | null
  build_demo_url: string | null
}

const STAGE_ORDER = ['initial','interested','qualifying','presenting','building','demo_sent','price_asked','negotiating','booking','booked','support','closed']

const STAGE_COLORS: Record<string, string> = {
  initial: '#64748b', interested: '#3b82f6', qualifying: '#6366f1', presenting: '#8b5cf6',
  building: '#f59e0b', demo_sent: '#06b6d4', price_asked: '#eab308', negotiating: '#f97316',
  booking: '#22c55e', booked: '#16a34a', support: '#a855f7', closed: '#ef4444',
}

const BUILD_COLORS: Record<string, string> = {
  pending: '#f59e0b', building: '#3b82f6', retrying: '#f97316',
  demo_sent: '#22c55e', manual_needed: '#a855f7', error: '#ef4444',
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function ConversationsSection() {
  const [convs, setConvs] = useState<SmsConversation[]>([])
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    const load = () =>
      fetch('/api/outreach/conversations')
        .then(r => r.json())
        .then(d => setConvs(d.conversations ?? []))
        .catch(() => {})
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const funnel: Record<string, number> = {}
  for (const c of convs) funnel[c.stage] = (funnel[c.stage] ?? 0) + 1

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Live Conversations — Sofia
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>auto-refreshes every 15s</span>
      </div>

      {/* Stage funnel */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {STAGE_ORDER.filter(s => funnel[s]).map(s => (
          <span key={s} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600,
            background: `${STAGE_COLORS[s]}18`, color: STAGE_COLORS[s],
            border: `1px solid ${STAGE_COLORS[s]}40`,
          }}>
            {s.replace('_', ' ')} <b>{funnel[s]}</b>
          </span>
        ))}
        {convs.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>No conversations yet — replies will appear here live.</span>
        )}
      </div>

      {/* Conversation cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {convs.slice(0, 30).map(c => {
          const isOpen = open === c.phone
          const demo = c.demo_url || c.build_demo_url
          return (
            <div key={c.phone}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(isOpen ? null : c.phone)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  padding: '3px 9px', borderRadius: 10, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
                  background: `${STAGE_COLORS[c.stage] ?? '#64748b'}18`, color: STAGE_COLORS[c.stage] ?? '#64748b',
                }}>
                  {c.stage.replace('_', ' ')}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {c.lead_name || c.phone}
                    <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 8, fontSize: 11.5 }}>
                      {[c.lead_niche, c.lead_city].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.last_message ? `“${c.last_message.slice(0, 90)}”` : '—'}
                  </div>
                </div>
                {c.offered_price ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap' }}>${c.offered_price}</span>
                ) : null}
                {c.build_status && (
                  <span style={{
                    padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                    background: `${BUILD_COLORS[c.build_status] ?? '#64748b'}18`,
                    color: BUILD_COLORS[c.build_status] ?? '#64748b',
                  }}>
                    build: {c.build_status}
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{timeAgo(c.updated_at)}</span>
              </button>

              {isOpen && (
                <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--border)' }}>
                  {demo && (
                    <a href={demo.startsWith('http') ? demo : `https://${demo}`} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', margin: '10px 0', fontWeight: 600 }}>
                      <ExternalLink size={12} /> {demo.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, maxHeight: 420, overflowY: 'auto' }}>
                    {(c.messages ?? []).map((m, i) => (
                      <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        padding: '8px 13px', borderRadius: 14, fontSize: 12.5, lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        background: m.role === 'user' ? 'var(--accent)' : 'var(--bg)',
                        color: m.role === 'user' ? '#fff' : 'var(--text)',
                        border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                        borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                        borderBottomLeftRadius: m.role === 'user' ? 14 : 4,
                      }}>
                        {m.text}
                      </div>
                    ))}
                    {(c.messages ?? []).length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        No stored history — last: “{c.last_message ?? '—'}” → “{c.last_reply ?? '—'}”
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [leads, setLeads]         = useState<OutreachLead[]>([])
  const [twilioMap, setTwilioMap] = useState<Record<string, TwilioStatus>>({})
  const [loading, setLoading]     = useState(true)
  const [twilioLoading, setTwilioLoading] = useState(false)
  const [filter, setFilter]       = useState<string>('all')
  const [search, setSearch]       = useState('')

  useEffect(() => {
    fetch('/api/outreach/leads')
      .then(r => r.json())
      .then(d => { setLeads(d.leads ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function loadTwilio() {
    setTwilioLoading(true)
    fetch('/api/outreach/twilio-status')
      .then(r => r.json())
      .then(d => { setTwilioMap(d.byPhone ?? {}); setTwilioLoading(false) })
      .catch(() => setTwilioLoading(false))
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  const totalSent   = leads.length
  const smsSent     = leads.filter(l => l.outreach_sent || l.sms_sent).length
  const emailSent   = leads.filter(l => l.outreach_sent && l.email).length
  const needFollowUp = leads.filter(l =>
    !l.follow_up_1_sent_at &&
    l.outreach_sent_at &&
    new Date(l.outreach_sent_at) < new Date(Date.now() - 3 * 86400000)
  ).length

  const twDelivered = Object.values(twilioMap).filter(m => m.status === 'delivered').length
  const twFailed    = Object.values(twilioMap).filter(m => m.status === 'failed' || m.status === 'undelivered').length

  const nicheGroups: Record<string, number> = {}
  for (const l of leads) nicheGroups[l.niche] = (nicheGroups[l.niche] ?? 0) + 1

  // ── Filter ───────────────────────────────────────────────────────────────

  const visible = leads.filter(l => {
    if (filter !== 'all' && l.niche !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || (l.phone ?? '').includes(q)
    }
    return true
  })

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', margin: 0 }}>
            Outreach Analytics
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            Who we contacted, what channel, delivery status
          </p>
        </div>
        <button
          onClick={loadTwilio}
          disabled={twilioLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: twilioLoading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: twilioLoading ? 'spin 1s linear infinite' : 'none' }} />
          {twilioLoading ? 'Loading Twilio…' : 'Load Delivery Status'}
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Sent"      value={totalSent}    icon={TrendingUp}     color="#6366f1" sub="all channels" />
        <StatCard label="SMS Sent"        value={smsSent}      icon={MessageSquare}  color="#3b82f6" sub="via Twilio" />
        <StatCard label="Email Sent"      value={emailSent}    icon={Mail}           color="#10b981" sub="via Resend" />
        <StatCard label="Follow-up Due"   value={needFollowUp} icon={Clock}          color="#f59e0b" sub=">3 days no reply" />
        <StatCard
          label="Delivered (Twilio)"
          value={Object.keys(twilioMap).length ? `${twDelivered}/${Object.keys(twilioMap).length}` : '—'}
          icon={CheckCircle2}
          color="#22c55e"
          sub={twilioLoading ? 'Loading…' : twFailed ? `${twFailed} failed` : 'Click Load above'}
        />
      </div>

      {/* Live Sofia conversations — stage funnel + chat threads */}
      <ConversationsSection />

      {/* Niche breakdown */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>By Niche</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === 'all' ? 'var(--accent)' : 'var(--surface)',
              color: filter === 'all' ? '#fff' : 'var(--text-2)',
              border: '1px solid var(--border)',
            }}
          >
            All ({totalSent})
          </button>
          {Object.entries(nicheGroups).sort((a,b) => b[1]-a[1]).map(([niche, cnt]) => (
            <button
              key={niche}
              onClick={() => setFilter(niche === filter ? 'all' : niche)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === niche ? 'var(--accent)' : 'var(--surface)',
                color: filter === niche ? '#fff' : 'var(--text-2)',
                border: '1px solid var(--border)',
              }}
            >
              {NICHE_EMOJI[niche] ?? '📌'} {niche} ({cnt})
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search name, city, phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 360,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--text)',
            outline: 'none',
          }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Business', 'Niche', 'City', 'Phone', 'Channel', 'Twilio Status', 'Sent', 'Follow-up', 'Site'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 12px',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(lead => {
                const phoneKey = normalisePhone(lead.phone)
                const tw = twilioMap[phoneKey]
                const statusInfo = STATUS_DOT[tw?.status ?? 'unknown']
                const channel = lead.sms_sent ? 'SMS' : lead.outreach_sent && lead.email ? 'Email' : 'SMS'
                const siteUrl = lead.vercel_url || lead.cloudflare_url

                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Business */}
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                        {lead.tier === 'tier1' ? 'T1 free site' : 'T2 AI reception'}
                      </div>
                    </td>

                    {/* Niche */}
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                      {NICHE_EMOJI[lead.niche] ?? '📌'} {lead.niche}
                    </td>

                    {/* City */}
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                      {lead.city}{lead.state ? `, ${lead.state}` : ''}
                    </td>

                    {/* Phone */}
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)', fontFamily: 'monospace', fontSize: 12 }}>
                      {fmtPhone(lead.phone)}
                    </td>

                    {/* Channel */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: channel === 'SMS' ? '#3b82f622' : '#10b98122',
                        color:      channel === 'SMS' ? '#3b82f6'   : '#10b981',
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                      }}>{channel}</span>
                    </td>

                    {/* Twilio status */}
                    <td style={{ padding: '10px 12px' }}>
                      {tw ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusInfo.color, flexShrink: 0 }} />
                          <span style={{ color: statusInfo.color, fontWeight: 600, fontSize: 12 }}>{statusInfo.label}</span>
                          {tw.error_code && <span style={{ color: '#ef4444', fontSize: 11 }}>({tw.error_code})</span>}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-2)', fontSize: 11 }}>
                          {Object.keys(twilioMap).length ? 'No record' : '—'}
                        </span>
                      )}
                    </td>

                    {/* Sent date */}
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)', fontSize: 12 }}>
                      {fmtDate(lead.outreach_sent_at ?? lead.sms_sent_at)}
                    </td>

                    {/* Follow-up */}
                    <td style={{ padding: '10px 12px', fontSize: 11 }}>
                      {lead.follow_up_1_sent_at ? (
                        <span style={{ color: '#22c55e' }}>✓ F1 {fmtDate(lead.follow_up_1_sent_at)}</span>
                      ) : lead.outreach_sent_at && new Date(lead.outreach_sent_at) < new Date(Date.now() - 3*86400000) ? (
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>⏰ Due</span>
                      ) : (
                        <span style={{ color: 'var(--text-2)' }}>—</span>
                      )}
                    </td>

                    {/* Site */}
                    <td style={{ padding: '10px 12px' }}>
                      {siteUrl ? (
                        <a href={siteUrl} target="_blank" rel="noreferrer" style={{
                          color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                        }}>
                          <ExternalLink size={12} /> View
                        </a>
                      ) : <span style={{ color: 'var(--text-2)' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-2)' }}>
              No leads match filter
            </div>
          )}

          <div style={{ marginTop: 12, color: 'var(--text-2)', fontSize: 12 }}>
            Showing {visible.length} of {totalSent} leads
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
