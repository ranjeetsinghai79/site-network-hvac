'use client'
import { useState } from 'react'
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react'
import { PLAN_CATALOG, type PlanKey } from '@/lib/plans'

const PLAN_LABEL: Record<string, string> = Object.fromEntries(
  (Object.entries(PLAN_CATALOG) as [PlanKey, typeof PLAN_CATALOG[PlanKey]][]).map(([key, plan]) => [
    key, `${plan.name} — $${plan.price / 100}${plan.billing === 'subscription' ? '/mo' : ' one-time'}`,
  ])
)

export function BillingCard({
  hasStripe,
  subscriptionActive,
  subscriptionPlan,
  paid,
}: {
  hasStripe: boolean
  subscriptionActive: boolean
  subscriptionPlan: string
  paid: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/client/billing-portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Could not open billing portal')
        setLoading(false)
      }
    } catch {
      setError('Network error — try again')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderRadius: 14,
        padding:      '22px 28px',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <CreditCard size={16} color="var(--accent-light)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Billing & Subscription</span>
      </div>

      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          justifyContent: 'space-between',
          flexWrap:      'wrap',
          gap:           12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {PLAN_LABEL[subscriptionPlan] ?? subscriptionPlan}
          </div>
          <div style={{ fontSize: 12, color: subscriptionActive || paid ? '#10b981' : 'var(--warning)' }}>
            {subscriptionActive ? '✓ Active subscription' : paid ? '✓ Paid' : 'Awaiting payment'}
          </div>
        </div>

        {hasStripe ? (
          <div>
            <button
              onClick={openPortal}
              disabled={loading}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                background:   loading ? 'var(--surface-2)' : 'var(--accent)',
                color:        '#fff',
                border:       'none',
                borderRadius: 8,
                padding:      '9px 18px',
                fontWeight:   700,
                fontSize:     13,
                cursor:       loading ? 'not-allowed' : 'pointer',
                transition:   'opacity 0.2s',
              }}
            >
              {loading
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Opening…</>
                : <><CreditCard size={14} /> Manage Billing <ExternalLink size={12} /></>}
            </button>
            {error && (
              <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 6 }}>{error}</div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Billing portal available after payment is processed.
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
