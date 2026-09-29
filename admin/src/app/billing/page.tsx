'use client'

import { useState } from 'react'

export default function BillingPage() {
  const [amount, setAmount]       = useState('')
  const [interval, setInterval]   = useState<'month' | 'year'>('month')
  const [desc, setDesc]           = useState('')
  const [email, setEmail]         = useState('')
  const [result, setResult]       = useState<{ url: string; price_id: string; email_sent?: boolean } | null>(null)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [copied, setCopied]       = useState(false)

  async function generate() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/stripe/custom-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), interval, description: desc, clientEmail: email }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (!result?.url) return
    navigator.clipboard.writeText(result.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 540 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 4 }}>
        Custom Payment Link
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 32 }}>
        Generate a Stripe recurring payment link for any amount.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Amount + Interval row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Amount (USD)</label>
            <input
              type="number" min="1" step="1" placeholder="199"
              value={amount} onChange={e => setAmount(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Billing Cycle</label>
            <select
              value={interval} onChange={e => setInterval(e.target.value as 'month' | 'year')}
              style={inputStyle}
            >
              <option value="month">Monthly</option>
              <option value="year">Annual</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Plan Description</label>
          <input
            type="text" placeholder="WebCrew AI Team — Multi-location"
            value={desc} onChange={e => setDesc(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Client email (optional) */}
        <div>
          <label style={labelStyle}>Client Email (optional)</label>
          <input
            type="email" placeholder="owner@theirbusiness.com"
            value={email} onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={loading || !amount}
          style={{
            padding: '12px 24px', borderRadius: 8, border: 'none',
            background: loading || !amount ? '#334155' : '#6366f1',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading || !amount ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Generating…' : `Generate $${amount || '0'}/${interval === 'month' ? 'mo' : 'yr'} Link`}
        </button>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: '#450a0a', color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ padding: '20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid #22c55e40' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Link Ready
              </div>
              {result.email_sent && (
                <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>
                  ✓ Email sent to {email}
                </div>
              )}
            </div>
            <div style={{
              background: '#0f172a', borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#94a3b8', wordBreak: 'break-all', marginBottom: 12,
            }}>
              {result.url}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={copy}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: copied ? '#22c55e' : '#6366f1',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={result.url} target="_blank" rel="noreferrer"
                style={{
                  padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                Open →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
