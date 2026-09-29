'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, ExternalLink, Loader2, Rocket, XCircle } from 'lucide-react'

type Step = { key: string; ok: boolean; detail: string }
type Result = { ok?: boolean; error?: string; leadId?: string; workspaceId?: string; paymentUrl?: string; status?: string; steps?: Step[] }

const PLANS = [
  { value: 'AI Front Office', amount: 297, label: 'AI Front Office — $297/mo · setup fee waived' },
]

const inputStyle = { width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 13, outline: 'none' }

export function OnboardClientForm() {
  const [form, setForm] = useState({ ownerName: '', businessName: '', email: '', phone: '', website: '', industry: '', city: '', state: '', plan: PLANS[0].value, amount: PLANS[0].amount })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  function update(name: string, value: string | number) { setForm(f => ({ ...f, [name]: value })) }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setResult(null)
    try {
      const response = await fetch('/api/clients/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json() as Result
      setResult(data)
    } catch (error: any) { setResult({ error: error?.message ?? 'Onboarding request failed' }) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(300px,.75fr)', gap: 20, alignItems: 'start' }}>
      <form onSubmit={submit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Owner name *"><input required value={form.ownerName} onChange={e => update('ownerName', e.target.value)} placeholder="Pavan Kumar" style={inputStyle} /></Field>
          <Field label="Business name *"><input required value={form.businessName} onChange={e => update('businessName', e.target.value)} placeholder="Mountain House Roofing" style={inputStyle} /></Field>
          <Field label="Email *"><input required type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="owner@business.com" style={inputStyle} /></Field>
          <Field label="US mobile / business phone *"><input required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(415) 555-0123" style={inputStyle} /></Field>
          <Field label="Industry"><input value={form.industry} onChange={e => update('industry', e.target.value)} placeholder="Roofing" style={inputStyle} /></Field>
          <Field label="Website (recommended)"><input type="url" value={form.website} onChange={e => update('website', e.target.value)} placeholder="https://business.com" style={inputStyle} /></Field>
          <Field label="City"><input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Mountain House" style={inputStyle} /></Field>
          <Field label="State"><input value={form.state} onChange={e => update('state', e.target.value)} placeholder="CA" maxLength={20} style={inputStyle} /></Field>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '22px 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr .5fr', gap: 14 }}>
          <Field label="Plan">
            <select value={form.plan} onChange={e => { const selected = PLANS.find(p => p.value === e.target.value); setForm(f => ({ ...f, plan: e.target.value, amount: selected ? selected.amount : f.amount })) }} style={inputStyle}>
              {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              <option value="Custom Plan">Custom plan</option>
            </select>
          </Field>
          <Field label="Monthly price (USD)"><input required type="number" min={59} step={1} value={form.amount} onChange={e => update('amount', Number(e.target.value))} style={inputStyle} /></Field>
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 9, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', color: 'var(--text-2)', fontSize: 12, lineHeight: 1.55 }}>
          $499 setup fee is waived for this client — the payment link only charges the monthly amount above. No phone number is purchased and no AI receptionist or dashboard access is provisioned until Stripe confirms successful payment.
        </div>
        <button disabled={loading} type="submit" style={{ width: '100%', marginTop: 18, border: 0, borderRadius: 9, padding: '12px 16px', background: loading ? 'var(--border-2)' : 'linear-gradient(135deg,#6366f1,#0ea5e9)', color: '#fff', fontWeight: 800, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          {loading ? <><Loader2 size={17} className="anim-spin" /> Creating payment request…</> : <><Rocket size={17} /> Create client & request payment</>}
        </button>
      </form>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 15 }}>Automation status</div>
        {!result && !loading && <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>Complete the form and click once. Results and recovery details appear here.</p>}
        {loading && ['Pending client record', 'Pending workspace', 'Secure Stripe subscription link', 'Payment request email'].map(label => <StatusRow key={label} loading label={label} />)}
        {result?.steps?.map(step => <StatusRow key={step.key} ok={step.ok} label={step.detail} />)}
        {result?.error && <div style={{ marginTop: 12, color: 'var(--error)', fontSize: 12 }}>{result.error}</div>}
        {result?.ok && <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
          {result.status && <ResultLine label="Status" value="Awaiting Stripe payment confirmation" />}
          {result.paymentUrl && <a href={result.paymentUrl} target="_blank" rel="noreferrer" style={linkStyle}>Open payment link <ExternalLink size={13} /></a>}
        </div>}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: 'block' }}><span style={{ display: 'block', color: 'var(--muted)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>{label}</span>{children}</label> }
function StatusRow({ label, ok, loading }: { label: string; ok?: boolean; loading?: boolean }) { return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, color: ok === false ? 'var(--error)' : ok ? 'var(--success)' : 'var(--text-2)', fontSize: 12, lineHeight: 1.4 }}>{loading ? <Circle size={14} style={{ opacity: .35 }} /> : ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}<span>{label}</span></div> }
function ResultLine({ label, value }: { label: string; value: string }) { return <div style={{ padding: '9px 11px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}><span style={{ color: 'var(--muted)' }}>{label}: </span><strong>{value}</strong></div> }
const linkStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--accent-dim-2)', border: '1px solid rgba(99,102,241,.25)', color: 'var(--accent-light)', textDecoration: 'none', fontSize: 12, fontWeight: 700 }
