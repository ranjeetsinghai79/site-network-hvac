import { OnboardClientForm } from '@/components/onboard-client-form'

export default function OnboardClientPage() {
  return (
    <div style={{ padding: '32px 36px', maxWidth: 1050 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>One-click client onboarding</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 5, lineHeight: 1.6 }}>
          Creates the client, workspace, billing link, AI receptionist, phone number, dashboard login, and welcome email. Safe to retry.
        </p>
      </div>
      <OnboardClientForm />
    </div>
  )
}
