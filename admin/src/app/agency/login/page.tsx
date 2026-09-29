"use client"

import { useState } from 'react'

export default function AgencyLoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    const response = await fetch('/api/platform/self/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    const data = await response.json(); setMessage(data.devLink ? `Development link: ${data.devLink}` : data.message ?? 'Check your email.'); setBusy(false)
  }
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#07070f' }}>
    <form onSubmit={submit} style={{ width: 'min(100%, 400px)', border: '1px solid #252540', background: '#0d0d1b', borderRadius: 8, padding: 28 }}>
      <div style={{ fontSize: 21, fontWeight: 850, color: '#e2e8f0' }}>WebCrew Agency Platform</div>
      <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.55, margin: '8px 0 22px' }}>Private beta access for invited agency operators.</p>
      <label style={label}>Work email</label>
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required style={input} placeholder="you@agency.com" />
      <button disabled={busy} style={button}>{busy ? 'Sending...' : 'Email sign-in link'}</button>
      {message && <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5, marginTop: 14, overflowWrap: 'anywhere' }}>{message}</p>}
    </form>
  </main>
}

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, color: '#94a3b8', marginBottom: 7, textTransform: 'uppercase' }
const input: React.CSSProperties = { width: '100%', minHeight: 42, border: '1px solid #252540', borderRadius: 6, background: '#121220', color: '#e2e8f0', padding: '0 12px', fontSize: 14, marginBottom: 12 }
const button: React.CSSProperties = { width: '100%', minHeight: 42, border: 0, borderRadius: 6, background: '#6366f1', color: '#fff', fontWeight: 800, cursor: 'pointer' }
