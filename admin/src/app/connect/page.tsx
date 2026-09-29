'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ConnectContent() {
  const params  = useSearchParams()
  const success = params.get('success') === '1'
  const error   = params.get('error')
  const leadId  = params.get('leadId') ?? ''

  if (success) {
    return (
      <div style={styles.card}>
        <div style={styles.icon}>✅</div>
        <h1 style={styles.h1}>Google Connected</h1>
        <p style={styles.body}>
          Your Google Business Profile and Search Console are now linked.
          Our AI team will start posting weekly GBP updates, replying to reviews,
          and sending you weekly traffic reports automatically.
        </p>
        <p style={styles.muted}>You can close this window.</p>
      </div>
    )
  }

  if (error === 'denied') {
    return (
      <div style={styles.card}>
        <div style={styles.icon}>⚠️</div>
        <h1 style={styles.h1}>Access Denied</h1>
        <p style={styles.body}>
          Google access was declined. Your AI agents for GBP posts, review replies,
          and traffic reports need Google access to run.
        </p>
        {leadId && (
          <a href={`/api/google/auth?leadId=${leadId}`} style={styles.btn}>
            Try Again
          </a>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.card}>
        <div style={styles.icon}>❌</div>
        <h1 style={styles.h1}>Something went wrong</h1>
        <p style={styles.body}>Error: {error}. Please try again or reply to your welcome email.</p>
        {leadId && (
          <a href={`/api/google/auth?leadId=${leadId}`} style={styles.btn}>
            Retry
          </a>
        )}
      </div>
    )
  }

  // Default: explain what this is (user lands here from onboarding email)
  return (
    <div style={styles.card}>
      <div style={styles.icon}>🤖</div>
      <h1 style={styles.h1}>Connect Your Google Account</h1>
      <p style={styles.body}>
        This unlocks 3 of your 5 AI agents:
      </p>
      <ul style={styles.list}>
        <li><strong>GBP Post Agent</strong> — posts a Google Business Profile update every week</li>
        <li><strong>Review Reply Agent</strong> — replies to every Google review within hours</li>
        <li><strong>Weekly Report</strong> — emails you your Google Search Console traffic every Monday</li>
      </ul>
      <p style={styles.body}>
        We only access your Google Business Profile and Search Console.
        We never access Gmail, Drive, or any other Google service.
        You can revoke access anytime from your Google account settings.
      </p>
      {leadId ? (
        <a href={`/api/google/auth?leadId=${leadId}`} style={styles.btn}>
          Connect Google →
        </a>
      ) : (
        <p style={styles.muted}>
          Please use the link from your WebCrew welcome email to connect your account.
        </p>
      )}
      <p style={styles.fine}>
        Scopes requested: Google Business Profile (manage), Google Search Console (read-only).
        Powered by WebCrew AI · <a href="https://webcrew.app/privacy" style={{ color: '#60a5fa' }}>Privacy Policy</a>
      </p>
    </div>
  )
}

export default function ConnectPage() {
  return (
    <div style={styles.page}>
      <Suspense fallback={<div style={styles.card}><p style={styles.muted}>Loading...</p></div>}>
        <ConnectContent />
      </Suspense>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
  },
  card: {
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '48px 40px',
    maxWidth: '520px',
    width: '100%',
    textAlign: 'center',
  },
  icon: { fontSize: '48px', marginBottom: '20px' },
  h1: {
    color: '#fff',
    fontSize: '1.8rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    marginBottom: '16px',
    marginTop: 0,
  },
  body: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: '1rem',
    lineHeight: 1.65,
    marginBottom: '16px',
  },
  list: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: '0.92rem',
    lineHeight: 1.8,
    textAlign: 'left',
    marginBottom: '20px',
    paddingLeft: '20px',
  },
  btn: {
    display: 'inline-block',
    background: 'linear-gradient(135deg,#16a34a,#15803d)',
    color: '#fff',
    textDecoration: 'none',
    padding: '14px 32px',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '1rem',
    marginTop: '8px',
    marginBottom: '20px',
  },
  muted: { color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', marginTop: '16px' },
  fine: { color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginTop: '24px', lineHeight: 1.6 },
}
